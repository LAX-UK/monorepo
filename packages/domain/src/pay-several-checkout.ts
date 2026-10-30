import {
  type CheckoutRailKind,
  type PaymentTierLimits,
  resolveCheckoutRail,
  validateCheckoutAmountPence,
} from "./payment-tier-policy.js";

export type PayTogetherRefusal =
  /** The payer has a compliance check open, so no payment can be taken from them for now. */
  | "payer_on_hold"
  /** The total is under the smallest amount a card or bank transfer can take. */
  | "below_minimum"
  /** The total is over the most one online payment can take. */
  | "over_limit"
  /** The total is large enough that the finance team reviews it first; pay fewer at once. */
  | "needs_finance_review";

export type PayTogetherDecision =
  | { allowed: true; rail: CheckoutRailKind }
  | { allowed: false; reason: PayTogetherRefusal };

/**
 * Whether the chosen invoices can be paid as one payment, and how. Every limit applies to the
 * total, never to each invoice on its own: one payment of the total is what the payer makes, so
 * the card or bank-transfer choice and the review threshold follow it. A total that one invoice
 * paid alone would have to send for review cannot be paid together, so a batch never slips under a
 * threshold that a single payment of the same money would meet.
 */
export function payTogether(
  totalPence: number,
  limits: PaymentTierLimits,
  payerOnHold: boolean,
): PayTogetherDecision {
  if (payerOnHold) return { allowed: false, reason: "payer_on_hold" };
  const validation = validateCheckoutAmountPence(totalPence, limits);
  if (validation === "invalid_amount") return { allowed: false, reason: "below_minimum" };
  if (validation === "blocked") return { allowed: false, reason: "over_limit" };
  if (totalPence >= limits.manualReviewMinPence) {
    return { allowed: false, reason: "needs_finance_review" };
  }
  const rail = resolveCheckoutRail(totalPence, limits);
  if (!rail) return { allowed: false, reason: "below_minimum" };
  return { allowed: true, rail };
}
