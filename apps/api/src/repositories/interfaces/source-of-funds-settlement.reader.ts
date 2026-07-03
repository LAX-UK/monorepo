import type {
  SofBatchPaymentSettlementRow,
  SofBatchWonUnpaidLotSaleRow,
  SofBlockedPaymentRow,
  SofPaymentSettlementRow,
  SofWonUnpaidLotSaleRow,
} from "../source-of-funds-settlement.types.js";

export interface ISourceOfFundsSettlementReader {
  fetchActivePaymentSettlementRows(userId: string): Promise<SofPaymentSettlementRow[]>;

  fetchWonUnpaidLotSaleRows(userId: string): Promise<SofWonUnpaidLotSaleRow[]>;

  fetchBatchPaymentSettlementRows(
    userIds: readonly string[],
  ): Promise<SofBatchPaymentSettlementRow[]>;

  fetchBatchWonUnpaidLotSaleRows(
    userIds: readonly string[],
  ): Promise<SofBatchWonUnpaidLotSaleRow[]>;

  sumActivePaymentExposurePence(userId: string): Promise<number>;

  fetchBlockedPaymentsForBuyer(userId: string): Promise<SofBlockedPaymentRow[]>;
}
