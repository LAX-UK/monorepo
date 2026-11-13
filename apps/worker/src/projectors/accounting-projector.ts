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
 * Books is configured and the switch aims at least one product at it. Its cursor starts at the
 * newest event the first time it runs, and while no product is aimed at Books it is moved to the
 * newest event every tick, so turning Books on (first time or again) only ever projects what
 * happens from then on: the events of a time Books was off belong to whatever booked them then,
 * and are never replayed under today's switch. A backfill is its own, deliberate command. If the
 * switch cannot be read, nothing moves. While Books is off, deliveries already queued are settled
 * (skipped) rather than left to be projected later. Each event becomes one delivery (lease, retry with backoff,
 * dead letter), and projecting it is idempotent by LAX reference and target.
 */
export async function processAccountingProjector(ctx: ProjectorRunContext): Promise<void> {
  const accounting = ctx.accounting;
  if (!accounting) return;
  if (!ctx.deliveryRepo) throw new Error(`${ACCOUNTING_PROJECTOR}_missing_delivery_repo`);
  const activity = await accounting.projection.activity();
  if (activity === "unreadable") return;
  const deliveryRepo = ctx.deliveryRepo;

  if (activity === "active") {
    await accounting.cursorStart.startAtLatestEvent(ACCOUNTING_PROJECTOR);
    await queueConsumerDeliveries(ctx, ACCOUNTING_PROJECTOR, accounting.projection.eventTypes());
  } else {
    // Nothing new is queued, and deliveries queued before Books was switched off are settled now
    // (each is skipped, `books_not_selected`), so none waits to be projected under a later switch.
    await accounting.cursorStart.moveToLatestEvent(ACCOUNTING_PROJECTOR);
  }

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
