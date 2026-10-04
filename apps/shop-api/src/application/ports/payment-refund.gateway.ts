export type SubmitRefundCommand = {
  refundId: string;
  paymentIntentId: string;
  amountPence: number;
  idempotencyKey: string;
};

export type SubmitRefundResult =
  | { ok: true; stripeRefundId: string }
  | { ok: false; retryable: boolean; message: string };

export interface PaymentRefundGateway {
  submitRefund(command: SubmitRefundCommand): Promise<SubmitRefundResult>;
}
