import { assertDomainEventConsumerContract, listDomainEventTypesForConsumer } from "@auction/types";
import { deliveryRepoForProjectorTransaction } from "../container/delivery-repo-for-projector-transaction.js";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import {
  recordDeliveryOldestPendingAgeSeconds,
  recordDeliveryOutcome,
} from "../lib/delivery-metrics.js";
import { claimAndRunDomainEventDeliveriesWithBudget } from "./lib/domain-event-delivery-runner.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const ZOHO_ARTWORK_WRITEBACK_PROJECTOR = "zoho_artwork_writeback";
const CONSUMER = ZOHO_ARTWORK_WRITEBACK_PROJECTOR;

const EVENT_TYPES = listDomainEventTypesForConsumer(CONSUMER);

const BATCH_LIMIT = 100;
const TICK_TIME_BUDGET_MS = 2_000;

/**
 * Sends artwork register changes to Zoho Products. It has its own cursor and delivery ledger so
 * the CRM sync's mode and event allowlist never decide whether an artwork reaches Zoho. A failed
 * delivery retries with backoff and then dead-letters in the same ledger as the CRM sync.
 */
export async function processZohoArtworkWriteback(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.zohoArtworkWriteback) return;
  if (!ctx.deliveryRepo) throw new Error("zoho_artwork_writeback_missing_delivery_repo");

  const writeback = ctx.zohoArtworkWriteback;
  const deliveryRepo = ctx.deliveryRepo;

  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const txDeliveryRepo = deliveryRepoForProjectorTransaction(tx, deliveryRepo);
    const events = await ctx.domainEventReader.listLockedForProjector(
      ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
      BATCH_LIMIT,
      tx as ProjectorDbConnection,
      { eventTypes: EVENT_TYPES },
    );
    for (const event of events) {
      await txDeliveryRepo.ensurePending({
        consumer: CONSUMER,
        eventId: event.id,
        idempotencyKey: `${CONSUMER}:${event.id}`,
      });
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(
        ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
        maxId,
        tx,
      );
    }
  });

  await claimAndRunDomainEventDeliveriesWithBudget({
    consumer: CONSUMER,
    batchSize: 1,
    leaseMs: 60_000,
    timeBudgetMs: TICK_TIME_BUDGET_MS,
    repo: deliveryRepo,
    metricsConsumer: CONSUMER,
    deliverOne: async (delivery) => {
      const event = await ctx.domainEventReader.getById(delivery.eventId);
      if (!event) throw new Error(`domain_event_missing:${delivery.eventId}`);
      assertDomainEventConsumerContract(event);

      const result = await writeback.deliver(event);
      switch (result.outcome) {
        case "success":
          recordDeliveryOutcome(CONSUMER, "success");
          return { ok: true as const, providerReference: result.providerReference };
        case "skipped":
          recordDeliveryOutcome(CONSUMER, "skipped");
          return { skipped: true as const, reason: result.reason };
        default:
          return { ok: false as const, error: result.error };
      }
    },
  });

  recordDeliveryOldestPendingAgeSeconds(
    CONSUMER,
    await deliveryRepo.oldestPendingAt({ consumer: CONSUMER }),
  );
}

export function createZohoArtworkWritebackProjector(): Projector {
  return {
    name: ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
    isEnabled(ctx) {
      return ctx.zohoArtworkWriteback != null;
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_ARTWORK_WRITEBACK_PROJECTOR);
      await processZohoArtworkWriteback(ctx);
    },
  };
}
