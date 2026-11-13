import type { Database } from "@auction/db";

/** Where a buyer-side refund was reported from. */
export type PaymentRefundSource =
  | "card_webhook"
  | "group_webhook"
  | "staff"
  | "blocked_capture"
  | "payout_topup"
  /** A compensating row for a counted refund Stripe later reported failed or cancelled. */
  | "refund_reversal";

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
  /**
   * Whole minor units, greater than zero; below zero only for `refund_reversal`, the compensating
   * row of a refund that was counted and then failed.
   */
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

/**
 * A record a failed or cancelled Stripe refund can be taken back from: an invoice's buyer record
 * or seller lines (id: the payment id), a courier quote's refunded figure (id: the quote id) or a
 * group's unattributed figure (id: the group id).
 */
export type RefundReversalTarget = {
  kind: "buyer" | "seller" | "delivery" | "unattributed";
  id: string;
};

/**
 * Which failed or cancelled Stripe refunds have been taken back from which record. A refund is
 * taken back from a record at most once, whichever path sees it (the webhook, the refund
 * reconcile job, the repair command). Read and write it under the lock that guards the record.
 */
export interface IRefundReversalLedger {
  /** The Stripe refund ids already taken back from the record. */
  reversedRefundIdsInTransaction(
    tx: Database,
    target: RefundReversalTarget,
  ): Promise<ReadonlySet<string>>;
  /**
   * Records that `amountPence` (above zero) of a Stripe refund is taken back from the record;
   * false when that refund was taken back from it before, in which case nothing may be written.
   */
  recordReversalInTransaction(
    tx: Database,
    target: RefundReversalTarget,
    reversal: { stripeRefundId: string; amountPence: number },
  ): Promise<boolean>;
}
