export type CheckoutSessionRail = "card" | "bank";

/** One Checkout session opened for an invoice, as recorded. */
export type RecordedCheckoutSession = {
  stripeSessionId: string;
  /** Null for a session opened before the rail was recorded. */
  rail: CheckoutSessionRail | null;
  /** Null for a session opened before the fingerprint was recorded. */
  parametersFingerprint: string | null;
  /** Set once the session is known to be closed. */
  closedAt: Date | null;
};

/** Every Stripe Checkout session opened for an invoice, so each can be found and closed later. */
export interface IPaymentCheckoutSessionStore {
  /** Idempotent: recording the same session again does nothing. */
  record(
    paymentId: string,
    stripeSessionId: string,
    detail?: { rail: CheckoutSessionRail; parametersFingerprint: string },
  ): Promise<void>;
  listSessionIds(paymentId: string): Promise<string[]>;
  /** The invoice's sessions, oldest first. */
  listSessions(paymentId: string): Promise<RecordedCheckoutSession[]>;
  /** Notes that the session can no longer be paid. */
  markClosed(stripeSessionId: string): Promise<void>;
}
