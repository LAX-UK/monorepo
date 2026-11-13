/** A Stripe refund seen before it was final, as last read from Stripe. */
export type StripeRefundSighting = {
  stripeRefundId: string;
  stripeChargeId: string;
  status: string;
  amountPence: number;
  /** The invoice the refund names in its metadata, when it names one. */
  paymentId: string | null;
  /** Kept with a refund staff made while it was not final (see `StaffRefundContext` in the API). */
  staffRefund?: Record<string, unknown> | null;
};

/** A watched refund the reconcile job is to read again. */
export type StripeRefundWatchRow = {
  stripeRefundId: string;
  stripeChargeId: string;
  status: string;
  amountPence: number;
  paymentId: string | null;
  staffRefund: Record<string, unknown> | null;
  attempts: number;
};

/**
 * Stripe refunds that were pending or requires_action when last seen. Rows are only added while
 * a refund is not final, re-read by the refund reconcile job and closed once settled.
 */
export interface IStripeRefundWatchRepository {
  /**
   * Starts watching each refund that is not final yet. A refund already watched keeps its row (a
   * webhook and the job seeing the same refund add one), and gains the staff context if it had none.
   */
  watch(refunds: readonly StripeRefundSighting[]): Promise<void>;
  /**
   * Takes up to `limit` unsettled rows whose next check is due, oldest first, and pushes each
   * one's next check `leaseMs` ahead so an overlapping run takes different rows.
   */
  claimDue(limit: number, leaseMs: number, now?: Date): Promise<StripeRefundWatchRow[]>;
  /** The refund is still not final, or reading it failed: check again at `nextCheckAt`. */
  reschedule(
    stripeRefundId: string,
    update: { status: string; nextCheckAt: Date; lastError: string | null },
  ): Promise<void>;
  /** The refund is final and its charge was settled from it. */
  markSettled(stripeRefundId: string, status: string, now?: Date): Promise<void>;
}
