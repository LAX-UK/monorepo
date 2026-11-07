import type { PayPlanProgress } from "@auction/types";
import type { CheckoutRailKind } from "./payment-tier-policy.js";

/** What is known about a payment that has been opened for a group of invoices. */
export type PayProgressFacts = {
  rail: CheckoutRailKind;
  /** The group's status: `open` while the checkout is waiting, `processing` once money is on its way. */
  status: "open" | "processing";
  /**
   * The payer finished the hosted checkout (a card was submitted, or a bank transfer was chosen).
   * Unknown counts as finished: the payment is then held, never offered again.
   */
  checkoutFinished: boolean;
  totalPence: number;
  /** What the bank transfer has delivered so far, from the provider's own records. */
  receivedPence: number;
  lotIds: readonly string[];
};

/**
 * Where a payment that is under way stands, or `null` when the payer has not finished it (an
 * abandoned checkout, which the next attempt ends). Money received is clamped to the total, so
 * the remainder is never negative and the share never passes 100. Figures are whole pence; the
 * share is rounded down, so a transfer that is one penny short never reads as complete.
 */
export function payProgressOf(facts: PayProgressFacts): PayPlanProgress | null {
  if (facts.status === "open" && !facts.checkoutFinished) return null;
  const method = facts.rail === "card" ? "card" : "bank_transfer";
  const receivedPence = Math.min(Math.max(0, facts.receivedPence), Math.max(0, facts.totalPence));
  const remainingPence = Math.max(0, facts.totalPence) - receivedPence;
  const stage =
    method === "card" ? "confirming" : receivedPence > 0 ? "part_received" : "awaiting_transfer";
  return {
    rail: method,
    stage,
    lotIds: [...facts.lotIds],
    totalPence: facts.totalPence,
    receivedPence,
    remainingPence,
    receivedPercent:
      facts.totalPence > 0 ? Math.floor((receivedPence * 100) / facts.totalPence) : 0,
  };
}
