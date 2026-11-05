/**
 * Money that reached us but could not be applied to an invoice. It is never refunded
 * automatically: finance gets a task and an alert, and decides (reinstate, refund, or apply).
 */
export const UNAPPLIED_MONEY_EVENT = "payment.unapplied_money_received";
/** Recorded when that money is refunded in full, which closes the finance task. */
export const UNAPPLIED_MONEY_RESOLVED_EVENT = "payment.unapplied_money_resolved";

export const UNAPPLIED_MONEY_REASONS = [
  /** The invoice was refunded before this money arrived. */
  "invoice_refunded",
  /** The invoice was already paid, by other money (a second checkout, or single and group). */
  "invoice_already_paid",
  /** Stripe took a different amount from the invoice total. */
  "amount_mismatch",
  /** A "Pay several" payment arrived but its invoices could no longer all be settled. */
  "group_not_settleable",
  /** A bank transfer landed in the buyer's Stripe balance with no open invoice to apply it to. */
  "customer_balance_unapplied",
  /** Stripe shows the invoice paid, but this process cannot record the payment itself. */
  "paid_not_recorded",
] as const;

export type UnappliedMoneyReason = (typeof UNAPPLIED_MONEY_REASONS)[number];

export type UnappliedMoney = {
  reason: UnappliedMoneyReason;
  paymentId: string | null;
  paymentGroupId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  /** Stripe customer, for money sitting in a customer balance. */
  stripeCustomerId: string | null;
  amountCents: number;
  currency: string;
};

export type UnappliedMoneyPayload = UnappliedMoney & { dedupeKey: string };

/**
 * One finance task per piece of money: the same intent (or balance credit) reported again, by a
 * webhook replay or a second cron run, has the same key and raises nothing new.
 */
export function unappliedMoneyDedupeKey(money: UnappliedMoney): string {
  const reference =
    money.stripePaymentIntentId ??
    money.stripeChargeId ??
    (money.stripeCustomerId ? `${money.stripeCustomerId}:${money.amountCents}` : null) ??
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
