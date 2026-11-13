import type { Database } from "@auction/db";
import type { GiveBackFailedRefundInput } from "@auction/finance-runtime";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { PayoutLineKind } from "@auction/types";

export type AddPaymentPayoutLineInput = {
  legalEntityId: string;
  paymentId: string;
  amount: string;
  kind: PayoutLineKind;
  sourceEventId?: string | null;
  note: string | null;
  /** When set, line insert + totals run inside this transaction. */
  tx?: Database;
};

export interface IPayoutAdjustmentService {
  /** Append a payment-linked line to the open payout, recalculating totals; or create a clawback payout. */
  addPaymentLineToOpenPayoutOrCreateClawback(input: AddPaymentPayoutLineInput): Promise<void>;

  /**
   * Give the seller back what a failed buyer refund had them charged: one refund line reversing
   * the buyer refund, for the difference to the share of what still stands. Returns the pence
   * given back (0 when nothing was written).
   */
  giveBackFailedRefund(input: GiveBackFailedRefundInput): Promise<{ sellerPence: number }>;

  /**
   * Hold the open payouts of several sellers in one global order (legal entity id, then payout id)
   * before a transaction moves any of them. Call it after the payments are held. A no-op for fewer
   * than two sellers.
   */
  lockOpenPayoutsForSellers(input: {
    legalEntityIds: readonly string[];
    tx: Database;
  }): Promise<void>;

  /** Recompute payout gross/net totals from line amounts. */
  recalculateTotalsFromLines(repo: IPayoutRepository, payoutId: string): Promise<void>;
}

export type { GiveBackFailedRefundInput };
