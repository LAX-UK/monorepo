import type { lot, sale } from "@auction/db/schema";
import type { PaymentStatus } from "@auction/types";

/** Payment statuses that represent live or settled buyer exposure for SoF aggregation. */
export const ACTIVE_BUYER_SETTLEMENT_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "requires_manual_review",
] as const satisfies readonly PaymentStatus[];

export type SofPaymentSettlementRow = {
  paymentId: string;
  paymentStatus: string;
  amount: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleId: string;
  saleTitle: string;
};

export type SofWonUnpaidLotSaleRow = {
  lotRow: typeof lot.$inferSelect;
  saleRow: typeof sale.$inferSelect;
};

export type SofBatchPaymentSettlementRow = {
  buyerId: string;
  amount: string;
  lotTitle: string;
  lotNumber: number | null;
  saleTitle: string;
};

export type SofBatchWonUnpaidLotSaleRow = {
  winnerId: string | null;
  lotRow: typeof lot.$inferSelect;
  saleRow: typeof sale.$inferSelect;
};

export type SofBlockedPaymentRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
};
