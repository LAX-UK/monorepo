/**
 * The one rule for counting Stripe refunds, shared by every path that records, announces or
 * claws back a refund (Pay several charges, single-invoice card refunds, staff refunds, deal
 * payments, unapplied money) and by the refund reconcile job and the repair command.
 *
 * Only a refund that has gone through (`succeeded`) counts. A `pending` or `requires_action`
 * refund can still fail or be cancelled; it is counted when Stripe reports it succeeded, whether
 * that is learnt from `charge.refund.updated` or from the reconcile job re-reading it. A refund
 * that ends `failed` or `canceled` returned nothing; if it had been counted (by the previous
 * release, or because Stripe reversed a succeeded refund) a compensating entry takes it back.
 */

/** Stripe's refund statuses. */
export type StripeRefundStatus =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "canceled";

const COUNTED: ReadonlySet<string> = new Set<StripeRefundStatus>(["succeeded"]);
const NOT_FINAL: ReadonlySet<string> = new Set<StripeRefundStatus>(["pending", "requires_action"]);
const RETURNED_NOTHING: ReadonlySet<string> = new Set<StripeRefundStatus>(["failed", "canceled"]);

/** The refund went through: it is recorded, announced and clawed back. */
export function isCountedRefund(status: string | null | undefined): boolean {
  return COUNTED.has(status ?? "");
}

/** The refund may still succeed or fail: nothing is counted yet, and it is watched. */
export function isUnsettledRefund(status: string | null | undefined): boolean {
  return NOT_FINAL.has(status ?? "");
}

/** The refund ended without returning money. */
export function isReturnedNothing(status: string | null | undefined): boolean {
  return RETURNED_NOTHING.has(status ?? "");
}

/** One refund on a charge, as Stripe lists it. */
export type ChargeRefund = {
  id: string;
  chargeId: string;
  amountPence: number;
  status: string;
  /** The invoice the refund names (`metadata.paymentId`), when it names one. */
  paymentId: string | null;
  /** The courier quote the refund names (`metadata.deliveryQuoteId`), when it names one. */
  deliveryQuoteId: string | null;
};

export type ChargeRefundTotals = {
  /** What has gone back to the buyer: the succeeded refunds added up. */
  countedPence: number;
  /** Refunds still pending or requiring action. */
  unsettledPence: number;
  /** Refunds that failed or were cancelled. */
  returnedNothingPence: number;
};

export function chargeRefundTotals(
  refunds: readonly Pick<ChargeRefund, "amountPence" | "status">[],
): ChargeRefundTotals {
  const totals: ChargeRefundTotals = {
    countedPence: 0,
    unsettledPence: 0,
    returnedNothingPence: 0,
  };
  for (const r of refunds) {
    if (isCountedRefund(r.status)) totals.countedPence += r.amountPence;
    else if (isUnsettledRefund(r.status)) totals.unsettledPence += r.amountPence;
    else if (isReturnedNothing(r.status)) totals.returnedNothingPence += r.amountPence;
  }
  return totals;
}

/**
 * How far a recorded refund total must move to match Stripe, in pence. Above zero: a refund went
 * through that is not recorded yet. Below zero: the record holds more than went through, and only
 * as much as refunds that failed or were cancelled explain is taken back; anything else above
 * Stripe's figure (money returned outside Stripe, for one) is left for finance. Zero: in step.
 */
export function refundCorrectionPence(input: {
  recordedPence: number;
  countedPence: number;
  returnedNothingPence: number;
}): number {
  const { recordedPence, countedPence, returnedNothingPence } = input;
  if (countedPence > recordedPence) return countedPence - recordedPence;
  if (recordedPence > countedPence) {
    return 0 - Math.min(recordedPence - countedPence, Math.max(0, returnedNothingPence));
  }
  return 0;
}
