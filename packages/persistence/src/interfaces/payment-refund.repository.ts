import type { Database } from "@auction/db";

/** Where a buyer-side refund was reported from. */
export type PaymentRefundSource = "card_webhook" | "group_webhook" | "staff" | "blocked_capture";

export type PaymentRefundEntry = {
  paymentId: string;
  /** The Stripe refund id when known, otherwise the id of the event that reported the refund. */
  idempotencyKey: string;
  /** Whole minor units, greater than zero. */
  amountPence: number;
  /** ISO 4217 code, any case. */
  currency: string;
  source: PaymentRefundSource;
};

/** Everything recorded as refunded to the buyer for a payment. */
export type PaymentRefundTotal = {
  /** The pound-sterling refunds added up, in pence. */
  pence: number;
  /** Currencies other than GBP the payment was refunded in (empty for every payment today). */
  otherCurrencies: readonly string[];
};

/** What the buyer has been given back for a payment, from Bid's own record. */
export interface IPaymentRefundReader {
  sumRefundedPence(paymentId: string): Promise<PaymentRefundTotal>;
}

/** The record the refund paths write in the transaction that publishes `payment.refunded`. */
export interface IPaymentRefundLedger {
  /** Records a refund once per key; false when that key was recorded before (a replay). */
  recordInTransaction(tx: Database, entry: PaymentRefundEntry): Promise<boolean>;
  sumRefundedPenceInTransaction(tx: Database, paymentId: string): Promise<PaymentRefundTotal>;
}
