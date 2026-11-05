/** Every Stripe Checkout session opened for an invoice, so each can be found and closed later. */
export interface IPaymentCheckoutSessionStore {
  /** Idempotent: recording the same session again does nothing. */
  record(paymentId: string, stripeSessionId: string): Promise<void>;
  listSessionIds(paymentId: string): Promise<string[]>;
}
