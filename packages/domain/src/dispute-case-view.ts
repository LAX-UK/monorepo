/**
 * How the finance team sorts dispute cases into the views of the Disputes screen, and how close a
 * case is to its respond-by date. Both read Stripe's status, so the rules live here once and the
 * list query, the case page and the tests share them.
 */
import { isDisputeAwaitingAllocation } from "./dispute-case.js";

/** The queues of the Disputes screen. A case is in `needs_allocation` or exactly one other. */
export type DisputeView = "needs_allocation" | "open" | "under_review" | "closed";

export const DISPUTE_UNDER_REVIEW_STATUSES: readonly string[] = [
  "under_review",
  "warning_under_review",
];

/** Statuses after which nothing is left to do with the card network. */
export const DISPUTE_CLOSED_STATUSES: readonly string[] = [
  "won",
  "lost",
  "warning_closed",
  "prevented",
  "charge_refunded",
];

/** Where a case sits by its status alone: waiting on us, with the card network, or finished. */
export function disputeStatusView(status: string): Exclude<DisputeView, "needs_allocation"> {
  if (DISPUTE_CLOSED_STATUSES.includes(status)) return "closed";
  if (DISPUTE_UNDER_REVIEW_STATUSES.includes(status)) return "under_review";
  return "open";
}

/** Whether the case belongs in a view; a case waiting for allocation is also in its status view. */
export function disputeBelongsToView(
  view: DisputeView,
  facts: { status: string; allocationState: "allocated" | "needs_allocation" },
): boolean {
  if (view === "needs_allocation") return isDisputeAwaitingAllocation(facts);
  return disputeStatusView(facts.status) === view;
}

export type DisputeDeadlineState =
  /** No deadline applies: the case is closed, or Stripe sent none. */
  | "none"
  | "submitted"
  | "overdue"
  /** Three days or fewer. */
  | "urgent"
  /** A week or less. */
  | "soon"
  | "ok";

export type DisputeDeadline = { state: DisputeDeadlineState; daysLeft: number | null };

const DAY_MS = 86_400_000;
const URGENT_DAYS = 3;
const SOON_DAYS = 7;

/** The respond-by date measured from `now`, in whole days rounded up. */
export function disputeDeadline(
  facts: { dueBy: Date | null; status: string; evidenceSubmitted: boolean },
  now: Date,
): DisputeDeadline {
  if (disputeStatusView(facts.status) === "closed" || !facts.dueBy) {
    return { state: "none", daysLeft: null };
  }
  if (facts.evidenceSubmitted) return { state: "submitted", daysLeft: null };
  const remaining = facts.dueBy.getTime() - now.getTime();
  if (remaining <= 0) return { state: "overdue", daysLeft: 0 };
  const daysLeft = Math.ceil(remaining / DAY_MS);
  const state = daysLeft <= URGENT_DAYS ? "urgent" : daysLeft <= SOON_DAYS ? "soon" : "ok";
  return { state, daysLeft };
}
