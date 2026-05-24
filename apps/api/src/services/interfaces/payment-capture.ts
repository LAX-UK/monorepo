import type { Database } from "@auction/db";

export type PaymentCaptureVia =
  | "admin_manual"
  | "xero_sync"
  | "stripe_checkout_webhook"
  | "stripe_payment_intent";

export type CapturePaymentInput = {
  paymentId: string;
  via: PaymentCaptureVia;
  stripeChargeId?: string | null;
  stripePaymentIntentId?: string | null;
  actorUserId?: string | null;
  /** When omitted, uses the default db connection and wraps in a transaction. */
  tx?: Database;
  /** When true, throws if the status guard prevents capture (webhook claim rollback). */
  requireApply?: boolean;
};

export type CapturePaymentResult = {
  captured: boolean;
};

export interface IPaymentCaptureService {
  capture(input: CapturePaymentInput): Promise<CapturePaymentResult>;
}
