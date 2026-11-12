/** Why a paid event could not be applied to its order, and Stripe cannot cure it by resending. */
export const UNAPPLIED_PAYMENT_FAILURES = [
  /** What was paid is not the order's total. */
  "amount_mismatch",
  /** Paid in a payment session that is not the one the order was opened with. */
  "session_mismatch",
  /** The print held for the order was no longer reserved for it when the payment arrived. */
  "edition_state_invalid",
  /** The order was already paid, in another payment session. */
  "paid_twice",
  /** The order had been closed (expired, cancelled, failed or refunded) before the payment. */
  "paid_after_close",
  /** Zoho says the artwork is Sold or Reserved and staff have not decided: nothing is fulfilled. */
  "paid_while_money_paused",
] as const;

export type UnappliedPaymentFailure = (typeof UNAPPLIED_PAYMENT_FAILURES)[number];

/** Every code a payment webhook can fail with; the route and the recorder read the code, never the text. */
export type ShopPaymentWebhookCode =
  | UnappliedPaymentFailure
  | "payment_not_found"
  /** The order changed between the failed attempt and recording it: try the event again. */
  | "payment_state_changed"
  | "refund_persist_failed";

export function isUnappliedPaymentFailure(
  code: ShopPaymentWebhookCode,
): code is UnappliedPaymentFailure {
  return (UNAPPLIED_PAYMENT_FAILURES as readonly ShopPaymentWebhookCode[]).includes(code);
}

export class ShopPaymentWebhookError extends Error {
  readonly code: ShopPaymentWebhookCode;
  readonly retryable: boolean;

  constructor(code: ShopPaymentWebhookCode, options: { retryable: boolean }) {
    super(code);
    this.name = "ShopPaymentWebhookError";
    this.code = code;
    this.retryable = options.retryable;
  }
}
