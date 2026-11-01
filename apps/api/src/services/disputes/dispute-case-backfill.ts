/**
 * Disputes recorded before dispute cases existed live only as domain events: `payment.dispute_*`
 * on the payment (with the seller clawback), and `payment.dispute_unmatched` for a charge no
 * payment matched. This turns those events into the dispute cases the Disputes screen lists.
 *
 * Only what the events and payments say is filled in. What only Stripe knows (the card, the
 * network reason code, whether evidence was submitted, whether the charge is refundable, and the
 * respond-by date unless an unmatched-dispute event carried it) stays empty and is reported.
 */

export type BackfillEvent = {
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
};

export type BackfillPayment = {
  id: string;
  sellerLegalEntityId: string;
  stripeChargeId: string | null;
};

export type PlannedCase = {
  stripeDisputeId: string;
  stripeChargeId: string;
  amountPence: number;
  currency: string;
  reason: string | null;
  status: string;
  dueBy: Date | null;
  stripeCreatedAt: Date;
  lastEventAt: Date;
  closedAt: Date | null;
  fundsWithdrawnAt: Date | null;
  fundsReinstatedAt: Date | null;
  allocationState: "allocated" | "needs_allocation";
  candidatePaymentIds: string[];
  /** Lines rebuilt from what the events already did to each seller's payout. */
  lines: {
    paymentId: string;
    sellerLegalEntityId: string;
    amountPence: number;
    sellerSharePence: number;
    clawback: "none" | "withdrawn" | "reversed";
  }[];
};

export type SkipReason = "already_a_case" | "no_charge_id" | "no_amount";

export type BackfillPlan = {
  cases: PlannedCase[];
  skipped: { stripeDisputeId: string; reason: SkipReason }[];
};

/** The columns this backfill cannot fill from events, for the command's report. */
export const FIELDS_ONLY_STRIPE_KNOWS = [
  "network reason code",
  "card brand and last four digits",
  "whether evidence was submitted (recorded as not submitted)",
  "whether the charge is refundable",
  "respond-by date (unless the unmatched-dispute event carried it)",
] as const;

const str = (payload: Record<string, unknown>, key: string): string | null => {
  const value = payload[key];
  return typeof value === "string" && value !== "" ? value : null;
};

const num = (payload: Record<string, unknown>, key: string): number | null => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const DISPUTE_EVENT_TYPES = new Set([
  "payment.dispute_opened",
  "payment.dispute_funds_withdrawn",
  "payment.dispute_closed",
  "payment.dispute_unmatched",
]);

export function isDisputeBackfillEvent(eventType: string): boolean {
  return DISPUTE_EVENT_TYPES.has(eventType);
}

function statusAfter(events: readonly BackfillEvent[]): string {
  let status = "needs_response";
  for (const event of events) {
    if (event.eventType === "payment.dispute_funds_withdrawn" && status === "needs_response") {
      status = "under_review";
    }
    if (event.eventType === "payment.dispute_closed") {
      const outcome = str(event.payload, "outcome");
      status = outcome === "won" ? "won" : outcome === "lost" ? "lost" : "warning_closed";
    }
  }
  return status;
}

/**
 * The cases to create. `events` may be in any order; disputes already recorded as cases
 * (`existingDisputeIds`) are skipped, so running again changes nothing.
 */
export function planDisputeCaseBackfill(input: {
  events: readonly BackfillEvent[];
  payments: readonly BackfillPayment[];
  existingDisputeIds: ReadonlySet<string>;
}): BackfillPlan {
  const paymentById = new Map(input.payments.map((p) => [p.id, p] as const));
  const byDispute = new Map<string, BackfillEvent[]>();
  for (const event of input.events) {
    if (!isDisputeBackfillEvent(event.eventType)) continue;
    const disputeId = str(event.payload, "stripeDisputeId");
    if (!disputeId) continue;
    byDispute.set(disputeId, [...(byDispute.get(disputeId) ?? []), event]);
  }

  const plan: BackfillPlan = { cases: [], skipped: [] };
  for (const [stripeDisputeId, unsorted] of [...byDispute].sort(([a], [b]) => a.localeCompare(b))) {
    if (input.existingDisputeIds.has(stripeDisputeId)) {
      plan.skipped.push({ stripeDisputeId, reason: "already_a_case" });
      continue;
    }
    const events = [...unsorted].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const opened = events.find((e) => e.eventType === "payment.dispute_opened");
    const unmatched = events.find((e) => e.eventType === "payment.dispute_unmatched");
    const first = opened ?? unmatched ?? events[0];
    if (!first) continue;

    const paymentIds = [
      ...new Set(
        events
          .filter(
            (e) =>
              e.eventType.startsWith("payment.dispute_") &&
              e.eventType !== "payment.dispute_unmatched",
          )
          .map((e) => e.aggregateId),
      ),
    ].filter((id) => paymentById.has(id));
    const chargeId =
      events.map((e) => str(e.payload, "stripeChargeId")).find((id) => id !== null) ??
      paymentIds.map((id) => paymentById.get(id)?.stripeChargeId ?? null).find((id) => id) ??
      null;
    if (!chargeId) {
      plan.skipped.push({ stripeDisputeId, reason: "no_charge_id" });
      continue;
    }
    const amountPence = events.map((e) => num(e.payload, "amountCents")).find((n) => n !== null);
    if (!amountPence || amountPence <= 0) {
      plan.skipped.push({ stripeDisputeId, reason: "no_amount" });
      continue;
    }

    const withdrawn = events.find((e) => e.eventType === "payment.dispute_funds_withdrawn");
    const closed = events.find((e) => e.eventType === "payment.dispute_closed");
    const status = statusAfter(events);
    const wonAfterWithdrawal = status === "won" && withdrawn !== undefined;
    const dueAt = unmatched ? str(unmatched.payload, "evidenceDueAt") : null;
    const lastEvent = events[events.length - 1] ?? first;

    const lines = paymentIds.flatMap((paymentId) => {
      const payment = paymentById.get(paymentId);
      if (!payment) return [];
      const amount = events
        .filter((e) => e.aggregateId === paymentId)
        .map((e) => num(e.payload, "amountCents"))
        .find((n) => n !== null);
      const linePence = amount && amount > 0 ? amount : amountPence;
      return [
        {
          paymentId,
          sellerLegalEntityId: payment.sellerLegalEntityId,
          amountPence: linePence,
          // Before cases existed, a withdrawn dispute took the whole amount from the seller.
          sellerSharePence: linePence,
          clawback: wonAfterWithdrawal
            ? ("reversed" as const)
            : withdrawn
              ? ("withdrawn" as const)
              : ("none" as const),
        },
      ];
    });

    plan.cases.push({
      stripeDisputeId,
      stripeChargeId: chargeId,
      amountPence,
      currency: events.map((e) => str(e.payload, "currency")).find((c) => c) ?? "gbp",
      reason: events.map((e) => str(e.payload, "reason")).find((r) => r) ?? null,
      status,
      dueBy: dueAt ? new Date(dueAt) : null,
      stripeCreatedAt: first.occurredAt,
      lastEventAt: lastEvent.occurredAt,
      closedAt: closed?.occurredAt ?? null,
      fundsWithdrawnAt: withdrawn?.occurredAt ?? null,
      fundsReinstatedAt: wonAfterWithdrawal ? (closed?.occurredAt ?? null) : null,
      allocationState: lines.length > 0 ? "allocated" : "needs_allocation",
      candidatePaymentIds: paymentIds,
      lines,
    });
  }
  return plan;
}
