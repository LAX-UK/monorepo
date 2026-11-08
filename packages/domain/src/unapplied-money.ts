/**
 * Money that reached us but could not be applied to an invoice. It is never refunded
 * automatically: finance gets a task and an alert, and decides (reinstate, refund, or apply).
 */
export const UNAPPLIED_MONEY_EVENT = "payment.unapplied_money_received";
/** Recorded when that money is refunded in full, which closes the finance task. */
export const UNAPPLIED_MONEY_RESOLVED_EVENT = "payment.unapplied_money_resolved";

export const UNAPPLIED_MONEY_REASONS = [
  /**
   * The invoice was cancelled before this money arrived. Finance reinstates or refunds it from
   * the closed-payment item; recording it here keeps its refund away from the seller's payout.
   */
  "invoice_cancelled",
  /** The invoice was refunded before this money arrived. */
  "invoice_refunded",
  /** The invoice was already paid, by other money (a second checkout, or single and group). */
  "invoice_already_paid",
  /** Stripe took a different amount from the invoice total. */
  "amount_mismatch",
  /** A "Pay several" payment arrived but its invoices could no longer all be settled. */
  "group_not_settleable",
  /** A "Pay several" payment is known to have received more than its own total. */
  "group_overpaid",
  /** A bank transfer landed in the buyer's Stripe balance with no open invoice to apply it to. */
  "customer_balance_unapplied",
  /** Stripe shows the invoice paid, but this process cannot record the payment itself. */
  "paid_not_recorded",
] as const;

export type UnappliedMoneyReason = (typeof UNAPPLIED_MONEY_REASONS)[number];

/** Reasons that close once the money is captured for its invoice (recorded, or reinstated). */
export const UNAPPLIED_MONEY_CLOSED_BY_CAPTURE: readonly UnappliedMoneyReason[] = [
  "paid_not_recorded",
  "invoice_cancelled",
];

/** Reasons finance handles from another inbox item (the closed-payment item), not this one. */
export const UNAPPLIED_MONEY_HANDLED_ELSEWHERE: readonly UnappliedMoneyReason[] = [
  "invoice_cancelled",
];

export type UnappliedMoney = {
  reason: UnappliedMoneyReason;
  paymentId: string | null;
  paymentGroupId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  /** Stripe customer, for money sitting in a customer balance. */
  stripeCustomerId: string | null;
  /**
   * A guess, never a fact: the one recent bank-transfer payment of the buyer's account this
   * balance might belong to. Set only when exactly one fits; finance checks before acting.
   */
  possibleGroup?: { id: string; status: "open" | "processing" | "paid" } | null;
  /** The Stripe event that reported money with no intent or charge (a balance credit). */
  stripeEventId?: string | null;
  amountCents: number;
  currency: string;
};

export type UnappliedMoneyPayload = UnappliedMoney & { dedupeKey: string };

/**
 * What finance reads about the payment a balance might belong to, worded by the payment's state.
 * A hedge, never a fact: the email and the work inbox both show it, so the words live here.
 */
export function possibleSourceText(
  group: NonNullable<UnappliedMoney["possibleGroup"]> | null,
): string | null {
  if (!group) return null;
  const ref = `PG-${group.id.slice(0, 8).toUpperCase()}`;
  return group.status === "paid"
    ? `Possible overpayment of payment ${ref}. Check before acting.`
    : `May belong to the unpaid payment ${ref}. Check before acting.`;
}

/**
 * One finance task per piece of money: the same intent (or balance credit) reported again, by a
 * webhook replay or a second cron run, has the same key and raises nothing new.
 */
export function unappliedMoneyDedupeKey(money: UnappliedMoney): string {
  const reference =
    money.stripePaymentIntentId ??
    money.stripeChargeId ??
    money.stripeEventId ??
    money.paymentGroupId ??
    money.paymentId ??
    "unknown";
  return `${money.reason}:${reference}`;
}

export function unappliedMoneyPayload(money: UnappliedMoney): UnappliedMoneyPayload {
  return {
    ...money,
    currency: money.currency.toUpperCase(),
    dedupeKey: unappliedMoneyDedupeKey(money),
  };
}
