import type { Database } from "@auction/db";

export interface IPayoutAdjustmentPort {
  addPaymentLineToOpenPayoutOrCreateClawback(input: {
    legalEntityId: string;
    paymentId: string;
    amount: string;
    kind: "refund";
    sourceEventId: string;
    note: string;
    tx: Database;
  }): Promise<void>;
}
