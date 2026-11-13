import type { Database } from "@auction/db";
import type { IPaymentRefundLedger, IRefundReversalLedger } from "@auction/persistence/interfaces";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { ReversibleRefund } from "../stripe/stripe-refund-status.js";

export type TakeBackFailedRefundsDeps = {
  paymentRefunds: Pick<IPaymentRefundLedger, "recordInTransaction"> &
    Pick<IRefundReversalLedger, "recordReversalInTransaction">;
  payoutAdjustments: Pick<IPayoutAdjustmentService, "addPaymentLineToOpenPayoutOrCreateClawback">;
};

/** The key of the entries taking one Stripe refund back from one invoice. */
export function refundReversalKey(stripeRefundId: string, paymentId: string): string {
  return `refund_reversal:${stripeRefundId}:${paymentId}`;
}

/**
 * Takes counted refunds that Stripe reports failed or cancelled back from an invoice: a
 * compensating buyer row and a seller payout line giving back the clawback, one per Stripe
 * refund. Each refund is claimed first in the reversal ledger, so it is taken back from the
 * buyer's record, and from the seller's lines, at most once whichever path (the webhook, the
 * refund reconcile job, the repair) gets there first. Call it under the payment's lock.
 * Returns what was taken back from each side, in pence.
 */
export async function takeBackFailedRefunds(
  deps: TakeBackFailedRefundsDeps,
  tx: Database,
  input: {
    paymentId: string;
    sellerLegalEntityId: string;
    currency: string;
    /** The refunds to take back from the buyer's record, each with the amount to take. */
    buyer: readonly ReversibleRefund[];
    /** The refunds to give back to the seller, each with the amount to give. */
    seller: readonly ReversibleRefund[];
    /** The payout line's note. */
    note: string;
  },
): Promise<{ buyerPence: number; sellerPence: number }> {
  let buyerPence = 0;
  let sellerPence = 0;
  for (const share of input.buyer) {
    const claimed = await deps.paymentRefunds.recordReversalInTransaction(
      tx,
      { kind: "buyer", id: input.paymentId },
      share,
    );
    if (!claimed) continue;
    await deps.paymentRefunds.recordInTransaction(tx, {
      paymentId: input.paymentId,
      idempotencyKey: refundReversalKey(share.stripeRefundId, input.paymentId),
      stripeRefundId: share.stripeRefundId,
      amountPence: -share.amountPence,
      currency: input.currency,
      source: "refund_reversal",
    });
    buyerPence += share.amountPence;
  }
  for (const share of input.seller) {
    const claimed = await deps.paymentRefunds.recordReversalInTransaction(
      tx,
      { kind: "seller", id: input.paymentId },
      share,
    );
    if (!claimed) continue;
    await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: input.sellerLegalEntityId,
      paymentId: input.paymentId,
      amount: (share.amountPence / 100).toFixed(2),
      kind: "refund",
      sourceEventId: refundReversalKey(share.stripeRefundId, input.paymentId),
      note: input.note,
      tx,
    });
    sellerPence += share.amountPence;
  }
  return { buyerPence, sellerPence };
}
