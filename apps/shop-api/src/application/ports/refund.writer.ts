export type RequestRefundCommand = {
  orderId: string;
  orderLineId?: string | undefined;
  amountPence: number;
  idempotencyKey: string;
  actorSubjectId: string;
};

export type RequestRefundResult = {
  refundId: string;
  status: "pending";
};

export interface RefundWriter {
  requestRefund(command: RequestRefundCommand): Promise<RequestRefundResult>;
}
