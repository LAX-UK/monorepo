import {
  type DomainEventConsumer,
  assertDomainEventConsumerContract,
  listDomainEventTypesForConsumer,
} from "@auction/types";
import { deliveryRepoForProjectorTransaction } from "../../container/delivery-repo-for-projector-transaction.js";
import type { CrmSyncResult } from "../../integrations/crm/crm-sync-result.js";
import type { ProjectorDbConnection } from "../../interfaces/worker-db.types.js";
import {
  recordDeliveryOldestPendingAgeSeconds,
  recordDeliveryOutcome,
} from "../../lib/delivery-metrics.js";
import { claimAndRunDomainEventDeliveriesWithBudget } from "./domain-event-delivery-runner.js";
import type { ProjectorRunContext } from "./projector.types.js";

const BATCH_LIMIT = 100;
const TICK_TIME_BUDGET_MS = 2_000;

/** Sends one domain event to Zoho and says how it went. */
export type ZohoProductDeliverer = {
  deliver(event: {
    id?: number;
    eventType: string;
    aggregateId?: string;
    payload: unknown;
  }): Promise<CrmSyncResult>;
};

/**
 * One consumer that writes to Zoho Products: its own cursor and delivery ledger, so another
 * consumer's mode and event list never decide whether an artwork reaches Zoho. A failed delivery
 * retries with backoff and then dead-letters in the same ledger as the CRM sync.
 */
export async function processZohoProductDeliveries(
  ctx: ProjectorRunContext,
  consumer: DomainEventConsumer,
  deliverer: ZohoProductDeliverer,
): Promise<void> {
  if (!ctx.deliveryRepo) throw new Error(`${consumer}_missing_delivery_repo`);
  const deliveryRepo = ctx.deliveryRepo;
  const eventTypes = listDomainEventTypesForConsumer(consumer);

  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const txDeliveryRepo = deliveryRepoForProjectorTransaction(tx, deliveryRepo);
    const events = await ctx.domainEventReader.listLockedForProjector(
      consumer,
      BATCH_LIMIT,
      tx as ProjectorDbConnection,
      { eventTypes },
    );
    for (const event of events) {
      await txDeliveryRepo.ensurePending({
        consumer,
        eventId: event.id,
        idempotencyKey: `${consumer}:${event.id}`,
      });
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(consumer, maxId, tx);
    }
  });

  await claimAndRunDomainEventDeliveriesWithBudget({
    consumer,
    batchSize: 1,
    leaseMs: 60_000,
    timeBudgetMs: TICK_TIME_BUDGET_MS,
    repo: deliveryRepo,
    metricsConsumer: consumer,
    deliverOne: async (delivery) => {
      const event = await ctx.domainEventReader.getById(delivery.eventId);
      if (!event) throw new Error(`domain_event_missing:${delivery.eventId}`);
      assertDomainEventConsumerContract(event);

      const result = await deliverer.deliver(event);
      switch (result.outcome) {
        case "success":
          recordDeliveryOutcome(consumer, "success");
          return { ok: true as const, providerReference: result.providerReference };
        case "skipped":
          recordDeliveryOutcome(consumer, "skipped");
          return { skipped: true as const, reason: result.reason };
        default:
          return { ok: false as const, error: result.error };
      }
    },
  });

  recordDeliveryOldestPendingAgeSeconds(consumer, await deliveryRepo.oldestPendingAt({ consumer }));
}
