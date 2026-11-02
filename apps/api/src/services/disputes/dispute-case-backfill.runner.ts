import type { Database } from "@auction/db";
import {
  disputeAllocation,
  disputeCase,
  disputeCaseCandidate,
  domainEvent,
  payment,
} from "@auction/db/schema";
import { inArray, sql } from "drizzle-orm";
import {
  type BackfillEvent,
  type BackfillPayment,
  type BackfillPlan,
  type PlannedCase,
  planDisputeCaseBackfill,
} from "./dispute-case-backfill.js";

const EVENT_TYPES = [
  "payment.dispute_opened",
  "payment.dispute_funds_withdrawn",
  "payment.dispute_closed",
  "payment.dispute_unmatched",
];

export type BackfillReport = {
  applied: boolean;
  plan: BackfillPlan;
  /** Cases written; always 0 in a dry run. */
  created: number;
};

async function loadEvents(db: Database): Promise<BackfillEvent[]> {
  const rows = await db
    .select({
      eventType: domainEvent.eventType,
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
      occurredAt: domainEvent.occurredAt,
    })
    .from(domainEvent)
    .where(inArray(domainEvent.eventType, EVENT_TYPES))
    .orderBy(domainEvent.id);
  return rows.map((row) => ({
    eventType: row.eventType,
    aggregateId: row.aggregateId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    occurredAt: row.occurredAt,
  }));
}

async function loadPayments(
  db: Database,
  events: readonly BackfillEvent[],
): Promise<BackfillPayment[]> {
  const ids = [
    ...new Set(
      events.filter((e) => e.eventType !== "payment.dispute_unmatched").map((e) => e.aggregateId),
    ),
  ];
  if (ids.length === 0) return [];
  return db
    .select({
      id: payment.id,
      sellerLegalEntityId: payment.sellerLegalEntityId,
      stripeChargeId: payment.stripeChargeId,
    })
    .from(payment)
    .where(inArray(payment.id, ids));
}

async function writeCase(db: Database, planned: PlannedCase): Promise<boolean> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(disputeCase)
      .values({
        stripeDisputeId: planned.stripeDisputeId,
        stripeChargeId: planned.stripeChargeId,
        amountPence: planned.amountPence,
        currency: planned.currency,
        reason: planned.reason,
        status: planned.status,
        dueBy: planned.dueBy,
        evidenceSubmitted: false,
        allocationState: planned.allocationState,
        fundsWithdrawnAt: planned.fundsWithdrawnAt,
        fundsReinstatedAt: planned.fundsReinstatedAt,
        stripeCreatedAt: planned.stripeCreatedAt,
        lastEventAt: planned.lastEventAt,
        closedAt: planned.closedAt,
      })
      .onConflictDoNothing({ target: disputeCase.stripeDisputeId })
      .returning({ id: disputeCase.id });
    const caseId = inserted[0]?.id;
    // Someone recorded it since the plan was made (a webhook, or an earlier run): leave it.
    if (!caseId) return false;
    if (planned.candidatePaymentIds.length > 0) {
      await tx
        .insert(disputeCaseCandidate)
        .values(planned.candidatePaymentIds.map((paymentId) => ({ caseId, paymentId })));
    }
    if (planned.lines.length > 0) {
      await tx.insert(disputeAllocation).values(
        planned.lines.map((line) => ({
          caseId,
          paymentId: line.paymentId,
          sellerLegalEntityId: line.sellerLegalEntityId,
          amountPence: line.amountPence,
          sellerSharePence: line.sellerSharePence,
          clawback: line.clawback,
          source: "legacy" as const,
        })),
      );
    }
    return true;
  });
}

/**
 * Plans, and with `apply` writes, the dispute cases for disputes known only from domain events.
 * It only inserts cases that do not exist yet (keyed on the Stripe dispute ID), publishes no
 * events and moves no payout: the money already moved when the events were recorded.
 */
export async function backfillDisputeCases(
  db: Database,
  options: { apply: boolean },
): Promise<BackfillReport> {
  const events = await loadEvents(db);
  const payments = await loadPayments(db, events);
  const existing = await db
    .select({ id: disputeCase.stripeDisputeId })
    .from(disputeCase)
    .where(sql`true`);
  const plan = planDisputeCaseBackfill({
    events,
    payments,
    existingDisputeIds: new Set(existing.map((row) => row.id)),
  });
  let created = 0;
  if (options.apply) {
    for (const planned of plan.cases) {
      if (await writeCase(db, planned)) created += 1;
    }
  }
  return { applied: options.apply, plan, created };
}
