export type FinanceCronInternalJobPath =
  | "expire-stale-payments"
  | "retry-refund-reconciles"
  | "refresh-xero-tokens"
  | "retry-xero-webhook-failures"
  | "retry-xero-stripe-capture-sync"
  | "retry-xero-invoice-creation"
  | "ensure-lot-invoices"
  | "process-notification-outbox"
  | "cleanup-display-pairings"
  | "bulk-payout-settlement";

export type IFinanceCronHandlers = {
  expireStalePayments(pendingDays: number, authorizedDays: number): Promise<unknown>;
  retryRefundReconciles(): Promise<unknown>;
  refreshXeroTokens(): Promise<unknown>;
  retryXeroWebhookFailures(): Promise<unknown>;
  retryXeroStripeCaptureSync(): Promise<unknown>;
  retryXeroInvoiceCreation(): Promise<unknown>;
  ensureLotInvoices(): Promise<unknown>;
  processNotificationOutbox(): Promise<unknown>;
  cleanupDisplayPairings(): Promise<unknown>;
  runBulkPayoutSettlement(): Promise<unknown>;
};
