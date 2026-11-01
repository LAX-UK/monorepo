/**
 * A card dispute on a Bid payment, and how it falls on the invoices the charge paid.
 *
 * Every dispute Stripe reports becomes a case, whether or not a payment matches its charge. A
 * charge that paid exactly one invoice is allocated to that invoice automatically. A charge that
 * paid several invoices ("Pay several"), or matches none, needs the finance team to allocate it:
 * until they do, no seller's payout moves.
 *
 * Money follows the case's funds, line by line: when Stripe withdraws the disputed funds, each
 * allocation line claws back its seller share once; when the funds come back (reinstated, or the
 * dispute is won), each clawed-back line is reversed once. A line allocated after the funds moved
 * catches up when it is saved.
 */

/** The webhook that reported the dispute. */
export type DisputeStage =
  | "created"
  | "updated"
  | "funds_withdrawn"
  | "funds_reinstated"
  | "closed";

export type DisputeAllocationState = "allocated" | "needs_allocation";

/** Where an allocation line came from. `legacy` lines rebuild what the ledger already holds. */
export type DisputeAllocationSource = "automatic" | "staff" | "legacy";

/** What a line has done to its seller's payout so far. */
export type DisputeLineClawback = "none" | "withdrawn" | "reversed";

/** What happened to the disputed funds, as Stripe reported it. */
export type DisputeFunds = { withdrawn: boolean; reinstated: boolean };

/** A payment the charge settled: one invoice, with what the seller earns from it. */
export type DisputeCandidate = {
  paymentId: string;
  sellerLegalEntityId: string;
  /** The invoice total. */
  amountPence: number;
  /** The house's fee on the invoice; the rest is the seller's. */
  platformFeePence: number;
};

export type DisputeAllocationLine = {
  paymentId: string;
  sellerLegalEntityId: string;
  /** How much of the disputed amount this invoice carries. */
  amountPence: number;
  /** How much of that comes out of the seller's payout. */
  sellerSharePence: number;
};

/** Stripe statuses after which a dispute can no longer change. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "won",
  "lost",
  "warning_closed",
  "prevented",
]);

/**
 * Statuses that end without the house losing the money. A case in one of these needs no
 * allocation to be worked on, so it leaves the queue.
 */
export const DISPUTE_STATUSES_WITHOUT_LOSS: readonly string[] = [
  "won",
  "warning_closed",
  "prevented",
];

export function isTerminalDisputeStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Whether the case is waiting for the finance team to allocate it. */
export function isDisputeAwaitingAllocation(input: {
  allocationState: DisputeAllocationState;
  status: string;
}): boolean {
  return (
    input.allocationState === "needs_allocation" &&
    !DISPUTE_STATUSES_WITHOUT_LOSS.includes(input.status)
  );
}

/**
 * The allocation made without asking anyone, or `null` when the finance team must decide. A charge
 * that paid exactly one invoice puts the whole disputed amount on it; the seller's payout carries
 * their net share of it, by the same rule as a finance allocation, and the house bears its fee's
 * part.
 */
export function planAutomaticDisputeAllocation(
  disputedPence: number,
  candidates: readonly DisputeCandidate[],
): DisputeAllocationLine[] | null {
  const [only, ...rest] = candidates;
  if (!only || rest.length > 0) return null;
  return [
    {
      paymentId: only.paymentId,
      sellerLegalEntityId: only.sellerLegalEntityId,
      amountPence: disputedPence,
      sellerSharePence: disputeSellerSharePence(disputedPence, only),
    },
  ];
}

/**
 * The seller's part of an amount allocated to their invoice: the same proportion as their net
 * share of the invoice. The house keeps its own fee's part, and any rounding.
 */
export function disputeSellerSharePence(
  allocatedPence: number,
  invoice: Pick<DisputeCandidate, "amountPence" | "platformFeePence">,
): number {
  if (invoice.amountPence <= 0) return 0;
  const netPence = Math.max(0, invoice.amountPence - invoice.platformFeePence);
  return Math.floor((allocatedPence * netPence) / invoice.amountPence);
}

/** The funds after a webhook. A won dispute's funds come back, whether or not Stripe says so. */
export function disputeFundsAfter(
  stage: DisputeStage,
  status: string,
  funds: DisputeFunds,
): DisputeFunds {
  if (stage === "funds_withdrawn") return { ...funds, withdrawn: true };
  if (stage === "funds_reinstated") return { ...funds, reinstated: true };
  if (stage === "closed" && status === "won") return { ...funds, reinstated: true };
  return funds;
}

/**
 * What a line must do to its seller's payout to match the funds: claw back once while the funds
 * are withdrawn, and reverse once when they come back. Funds that came back before the line
 * clawed anything leave it alone, so a late "withdrawn" never charges a seller for a won case.
 */
export function disputeLineEffect(
  funds: DisputeFunds,
  line: DisputeLineClawback,
): "withdraw" | "reverse" | null {
  if (funds.reinstated) return line === "withdrawn" ? "reverse" : null;
  if (funds.withdrawn) return line === "none" ? "withdraw" : null;
  return null;
}

/** Whether a webhook's copy of the dispute is newer than the one stored. Ties apply. */
export function isNewerDisputeSnapshot(storedAt: Date, eventAt: Date): boolean {
  return eventAt.getTime() >= storedAt.getTime();
}

export type DisputeAllocationRefusal =
  | "no_lines"
  | "duplicate_payment"
  | "unknown_payment"
  | "not_a_candidate"
  | "amount_not_positive"
  | "exceeds_invoice"
  | "total_mismatch";

export type DisputeAllocationDecision =
  | { ok: true; lines: DisputeAllocationLine[] }
  | { ok: false; reason: DisputeAllocationRefusal };

/**
 * Checks a finance allocation. Every line names a different invoice the charge paid (any known
 * invoice when the charge matched none), carries a positive amount no larger than the invoice,
 * and the lines add up to the disputed amount exactly.
 */
export function decideDisputeAllocation(input: {
  disputedPence: number;
  /** The invoices the charge paid; empty when it matched none. */
  candidatePaymentIds: readonly string[];
  /** The invoices the lines name, as found. */
  invoices: readonly DisputeCandidate[];
  lines: readonly { paymentId: string; amountPence: number }[];
}): DisputeAllocationDecision {
  if (input.lines.length === 0) return { ok: false, reason: "no_lines" };
  const invoices = new Map(input.invoices.map((i) => [i.paymentId, i]));
  const candidates = new Set(input.candidatePaymentIds);
  const seen = new Set<string>();
  const lines: DisputeAllocationLine[] = [];
  let totalPence = 0;
  for (const line of input.lines) {
    if (seen.has(line.paymentId)) return { ok: false, reason: "duplicate_payment" };
    seen.add(line.paymentId);
    const invoice = invoices.get(line.paymentId);
    if (!invoice) return { ok: false, reason: "unknown_payment" };
    if (candidates.size > 0 && !candidates.has(line.paymentId)) {
      return { ok: false, reason: "not_a_candidate" };
    }
    if (!Number.isInteger(line.amountPence) || line.amountPence <= 0) {
      return { ok: false, reason: "amount_not_positive" };
    }
    if (line.amountPence > invoice.amountPence) return { ok: false, reason: "exceeds_invoice" };
    totalPence += line.amountPence;
    lines.push({
      paymentId: invoice.paymentId,
      sellerLegalEntityId: invoice.sellerLegalEntityId,
      amountPence: line.amountPence,
      sellerSharePence: disputeSellerSharePence(line.amountPence, invoice),
    });
  }
  if (totalPence !== input.disputedPence) return { ok: false, reason: "total_mismatch" };
  return { ok: true, lines };
}
