export interface IAccountingReplayInvoiceProvider {
  isConfigured(): boolean;
  syncInvoiceFromProvider(
    tenantId: string,
    resourceId: string,
  ): Promise<{ ok: boolean; error?: string }>;
}

export interface IAccountingReplayPaymentRecorder {
  recordStripeCapture(
    paymentId: string,
    amountMajor: string,
  ): Promise<{ ok: boolean; error?: string }>;
  recordRefundCreditNote(
    paymentId: string,
    amountMajor: string,
    reference: string,
  ): Promise<{ ok: boolean; error?: string }>;
}

export interface IAccountingReplayPaymentMaintenance {
  backfillXeroInvoiceForPayment(paymentId: string): Promise<{ ok: boolean; error?: string }>;
}

export type XeroProactiveTokenRefreshResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; status?: number; result?: unknown };

export interface IXeroProactiveTokenRefresher {
  isConfigured(): boolean;
  refresh(): Promise<XeroProactiveTokenRefreshResult>;
}
