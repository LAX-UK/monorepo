import type { Database } from "@auction/db";
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

  /** Recompute payout gross/net totals from line amounts. */
  recalculateTotalsFromLines(repo: IPayoutRepository, payoutId: string): Promise<void>;
}
