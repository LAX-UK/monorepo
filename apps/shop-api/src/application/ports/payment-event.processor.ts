/**
 * What became of a paid event:
 *  - `processed`: the order was paid (or already was, in this same payment session);
 *  - `duplicate`: this Stripe event was handled before;
 *  - `terminal_acknowledged`: the order was closed, so the money was recorded for finance;
 *  - `unapplied_recorded`: the payment could not be applied (wrong amount or session, the print
 *    no longer held, or a second payment), so the money was recorded for finance.
 * The last two mean Stripe may stop sending it: the money is tracked.
 */
export type CompleteCheckoutOutcome =
  | "processed"
  | "duplicate"
  | "terminal_acknowledged"
  | "unapplied_recorded";

export type PaymentEventProcessor = {
  completeCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
    paymentIntentId?: string | null;
    /** Whether Stripe sent it from live mode. */
    livemode?: boolean;
  }): Promise<CompleteCheckoutOutcome>;
  expireCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  failCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  recordCurrencyViolation(input: {
    eventId: string;
    orderId: string;
    currency: string;
    sessionId: string;
  }): Promise<"processed" | "duplicate">;
};
