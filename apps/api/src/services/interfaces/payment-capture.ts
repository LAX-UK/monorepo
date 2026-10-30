import type { Database } from "@auction/db";

export type PaymentCaptureVia =
  | "admin_manual"
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

export type CaptureInTransactionInput = Omit<CapturePaymentInput, "tx" | "requireApply"> & {
  tx: Database;
  /**
   * Whether the buyer is told about this payment on its own. Invoices settled together get one
   * receipt for the whole payment instead, sent by the caller.
   */
  buyerReceipt: "each" | "none";
};

export type CaptureInTransactionResult = {
  captured: boolean;
  /** Notices, fulfilment and accounting for the capture; run once the transaction commits. */
  afterCommit: () => Promise<void>;
};

/** Marks a payment captured inside the caller's transaction, deferring its side effects. */
export interface IPaymentCaptureInTransaction {
  captureInTransaction(input: CaptureInTransactionInput): Promise<CaptureInTransactionResult>;
}
