import type { Database } from "@auction/db";

/** Where a buyer-side refund was reported from. */
export type PaymentRefundSource = "card_webhook" | "group_webhook" | "staff" | "blocked_capture";

export type PaymentRefundEntry = {
  paymentId: string;
  /**
   * The `source_event_id` of the payout line the same refund writes (the Stripe event id,
   * `<event id>:<payment id>` for a Pay several charge, the staff refund's own id), so a backfill
   * from payout lines can tell a refund this record already holds.
   */
  idempotencyKey: string;
  /** The Stripe refund id, when one is known. */
  stripeRefundId?: string | null;
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
  /**
   * Locks the payment row (`SELECT ... FOR UPDATE`) so refunds of one payment run one at a time,
   * then copies in any refund its payout lines hold that this record lacks (one the previous
   * release handled during a rollout). Call it before `sumRefundedPenceInTransaction`: the sum is
   * only right while the lock is held. False when the payment does not exist.
   */
  lockPaymentInTransaction(tx: Database, paymentId: string): Promise<boolean>;
  sumRefundedPenceInTransaction(tx: Database, paymentId: string): Promise<PaymentRefundTotal>;
}
