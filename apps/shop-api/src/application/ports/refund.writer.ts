import type { AdminRefundReason } from "@auction/shop-contracts";

export type RequestRefundCommand = {
  orderId: string;
  orderLineId?: string | undefined;
  amountPence: number;
  idempotencyKey: string;
  actorSubjectId: string;
  reason?: AdminRefundReason | undefined;
  note?: string | undefined;
};

export type RequestRefundResult = {
  refundId: string;
  status: "pending";
};

export interface RefundWriter {
  requestRefund(command: RequestRefundCommand): Promise<RequestRefundResult>;
}
