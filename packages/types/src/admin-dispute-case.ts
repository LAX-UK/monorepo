/** Derived dispute case status for admin finance UI. */
export type DisputeCaseStatus =
  | "open"
  | "under_review"
  | "warning_needs_response"
  | "won"
  | "lost"
  /** Closed without a clear won/lost Stripe outcome. */
  | "closed";

export type DisputeCaseOutcome = "won" | "lost" | "closed" | null;

export const OPEN_DISPUTE_CASE_STATUSES: readonly DisputeCaseStatus[] = [
  "open",
  "under_review",
  "warning_needs_response",
] as const;

export type DisputeDomainEventInput = {
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
};

export type AdminDisputeCaseTimelineEvent = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type AdminDisputeCaseRow = {
  stripeDisputeId: string;
  paymentId: string;
  status: DisputeCaseStatus;
  amountCents: number;
  currency: string;
  reason: string | null;
  sellerLegalEntityId: string;
  openedAt: string;
  closedAt: string | null;
  outcome: DisputeCaseOutcome;
  lotId?: string;
  lotTitle?: string;
  buyerId?: string;
  buyerLabel?: string | null;
  sellerDisplayName?: string | null;
  timelineEvents?: readonly AdminDisputeCaseTimelineEvent[];
};

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function payloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function deriveStatusFromEvents(events: readonly DisputeDomainEventInput[]): {
  status: DisputeCaseStatus;
  outcome: DisputeCaseOutcome;
  closedAt: string | null;
} {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  let status: DisputeCaseStatus = "open";
  let outcome: DisputeCaseOutcome = null;
  let closedAt: string | null = null;

  for (const event of sorted) {
    if (event.eventType === "payment.dispute_opened") {
      status = "open";
    } else if (event.eventType === "payment.dispute_funds_withdrawn") {
      status = "under_review";
    } else if (event.eventType === "payment.dispute_closed") {
      const raw = payloadString(event.payload, "outcome");
      if (raw === "won") {
        status = "won";
        outcome = "won";
      } else if (raw === "lost") {
        status = "lost";
        outcome = "lost";
      } else {
        status = "closed";
        outcome = "closed";
      }
      closedAt = event.occurredAt.toISOString();
    }
  }

  return { status, outcome, closedAt };
}

function foldSingleDisputeCase(
  stripeDisputeId: string,
  events: readonly DisputeDomainEventInput[],
): AdminDisputeCaseRow | null {
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const opened = sorted.find((e) => e.eventType === "payment.dispute_opened") ?? sorted[0];
  if (!opened) return null;

  const payload = opened.payload;
  const paymentId = opened.aggregateId;
  const amountCents = payloadNumber(payload, "amountCents") ?? 0;
  const currency = payloadString(payload, "currency") ?? "gbp";
  const reason = payloadString(payload, "reason");
  const sellerLegalEntityId = payloadString(payload, "sellerLegalEntityId") ?? "";

  const { status, outcome, closedAt } = deriveStatusFromEvents(events);

  return {
    stripeDisputeId,
    paymentId,
    status,
    amountCents,
    currency,
    reason,
    sellerLegalEntityId,
    openedAt: opened.occurredAt.toISOString(),
    closedAt,
    outcome,
  };
}

/** Fold redacted dispute domain events into one row per Stripe dispute id. */
export function foldDisputeCasesFromEvents(
  events: readonly DisputeDomainEventInput[],
): AdminDisputeCaseRow[] {
  const byDisputeId = new Map<string, DisputeDomainEventInput[]>();

  for (const event of events) {
    const disputeId = payloadString(event.payload, "stripeDisputeId");
    if (!disputeId) continue;
    const bucket = byDisputeId.get(disputeId) ?? [];
    bucket.push(event);
    byDisputeId.set(disputeId, bucket);
  }

  const cases: AdminDisputeCaseRow[] = [];
  for (const [stripeDisputeId, group] of byDisputeId) {
    const row = foldSingleDisputeCase(stripeDisputeId, group);
    if (row) cases.push(row);
  }

  return cases.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function isOpenDisputeCaseStatus(status: DisputeCaseStatus): boolean {
  return (OPEN_DISPUTE_CASE_STATUSES as readonly string[]).includes(status);
}

export type DisputeCaseListFilter = "open" | "under_review" | "closed" | undefined;

export function filterDisputeCasesByChip(
  rows: readonly AdminDisputeCaseRow[],
  filter: DisputeCaseListFilter,
): AdminDisputeCaseRow[] {
  if (!filter) return [...rows];
  if (filter === "open") {
    return rows.filter((r) => r.status === "open" || r.status === "warning_needs_response");
  }
  if (filter === "under_review") {
    return rows.filter((r) => r.status === "under_review");
  }
  return rows.filter((r) => r.status === "won" || r.status === "lost" || r.status === "closed");
}

export type AdminDisputeCaseSummary = {
  open: number;
  underReview: number;
  won: number;
  lost: number;
  closed: number;
};

export function summarizeDisputeCases(
  rows: readonly AdminDisputeCaseRow[],
): AdminDisputeCaseSummary {
  return rows.reduce(
    (acc, row) => {
      if (row.status === "open" || row.status === "warning_needs_response") acc.open += 1;
      else if (row.status === "under_review") acc.underReview += 1;
      else if (row.status === "won") acc.won += 1;
      else if (row.status === "lost") acc.lost += 1;
      else if (row.status === "closed") acc.closed += 1;
      return acc;
    },
    { open: 0, underReview: 0, won: 0, lost: 0, closed: 0 },
  );
}

export function countOpenDisputeCases(rows: readonly AdminDisputeCaseRow[]): number {
  return rows.filter((r) => isOpenDisputeCaseStatus(r.status)).length;
}
