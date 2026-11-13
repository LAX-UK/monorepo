import { assertDomainEventConsumerContract } from "@auction/types";
import {
  recordDeliveryOldestPendingAgeSeconds,
  recordDeliveryOutcome,
} from "../lib/delivery-metrics.js";
import { claimAndRunDomainEventDeliveriesWithBudget } from "./lib/domain-event-delivery-runner.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { queueConsumerDeliveries } from "./lib/queue-consumer-deliveries.js";

/** The consumer and projector name: one cursor and one delivery ledger for the books. */
export const ACCOUNTING_PROJECTOR = "accounting";
const TICK_TIME_BUDGET_MS = 2_000;

/**
 * Turns Bid invoices, payments and refunds into accounting documents for Books. Runs only while
 * Books is configured and the switch aims at least one product at it; otherwise it reads the switch
 * and stops, writing nothing. Its cursor starts at the newest event the first time it runs, so
 * turning it on never replays history. Each event becomes one delivery (lease, retry with backoff,
 * dead letter), and projecting it is idempotent by LAX reference.
 */
export async function processAccountingProjector(ctx: ProjectorRunContext): Promise<void> {
  const accounting = ctx.accounting;
  if (!accounting) return;
  if (!ctx.deliveryRepo) throw new Error(`${ACCOUNTING_PROJECTOR}_missing_delivery_repo`);
  if (!(await accounting.projection.isActive())) return;
  const deliveryRepo = ctx.deliveryRepo;

  await accounting.cursorStart.startAtLatestEvent(ACCOUNTING_PROJECTOR);
  await queueConsumerDeliveries(ctx, ACCOUNTING_PROJECTOR, accounting.projection.eventTypes());

  await claimAndRunDomainEventDeliveriesWithBudget({
    consumer: ACCOUNTING_PROJECTOR,
    batchSize: 1,
    leaseMs: 60_000,
    timeBudgetMs: TICK_TIME_BUDGET_MS,
    repo: deliveryRepo,
    metricsConsumer: ACCOUNTING_PROJECTOR,
    deliverOne: async (delivery) => {
      const event = await ctx.domainEventReader.getById(delivery.eventId);
      if (!event) throw new Error(`domain_event_missing:${delivery.eventId}`);
      assertDomainEventConsumerContract(event);
      const result = await accounting.projection.project(event);
      if (result.outcome === "skipped") {
        recordDeliveryOutcome(ACCOUNTING_PROJECTOR, "skipped");
        return { skipped: true as const, reason: result.reason };
      }
      ctx.log.info({ eventId: event.id, ...result }, "accounting_projected");
      recordDeliveryOutcome(ACCOUNTING_PROJECTOR, "success");
      return { ok: true as const };
    },
  });

  recordDeliveryOldestPendingAgeSeconds(
    ACCOUNTING_PROJECTOR,
    await deliveryRepo.oldestPendingAt({ consumer: ACCOUNTING_PROJECTOR }),
  );
}

export function createAccountingProjector(): Projector {
  return {
    name: ACCOUNTING_PROJECTOR,
    isEnabled(ctx) {
      return ctx.accounting != null;
    },
    async run(ctx) {
      await processAccountingProjector(ctx);
    },
  };
}
