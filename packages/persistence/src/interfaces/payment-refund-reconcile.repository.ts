export type PaymentRefundReconcilePayload = {
  sellerLegalEntityId: string | null;
  amount: string;
  stripeRefundId: string | null;
  via: "admin_manual" | "admin_manual_review";
};

export type PaymentRefundReconcileRow = {
  id: string;
  paymentId: string;
  stripeRefundId: string | null;
  adminUserId: string | null;
  payload: PaymentRefundReconcilePayload;
  attempts: number;
  lastError: string | null;
  reconciledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface IPaymentRefundReconcileRepository {
  enqueue(input: {
    paymentId: string;
    stripeRefundId: string | null;
    adminUserId: string | null;
    payload: PaymentRefundReconcilePayload;
  }): Promise<void>;

  listPending(limit: number): Promise<PaymentRefundReconcileRow[]>;

  markReconciled(paymentId: string): Promise<void>;

  markFailed(paymentId: string, error: string, attempts: number): Promise<void>;

  listPendingStripeCaptureSync(
    limit: number,
  ): Promise<Array<{ paymentId: string; amount: string }>>;

  listPaymentsMissingXeroInvoice(limit: number): Promise<
    Array<{
      paymentId: string;
      lotId: string;
      buyerId: string;
      amount: string;
    }>
  >;
}
