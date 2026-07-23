import type { AccountingReplayCronService } from "@auction/finance-cron-app";

export interface IFinanceAccountingCronApplicationService {
  retryXeroWebhookFailures(): ReturnType<AccountingReplayCronService["retryXeroWebhookFailures"]>;
  refreshXeroTokens(): ReturnType<AccountingReplayCronService["refreshXeroTokens"]>;
  retryXeroStripeCaptureSync(): ReturnType<
    AccountingReplayCronService["retryXeroStripeCaptureSync"]
  >;
  retryXeroInvoiceCreation(): ReturnType<AccountingReplayCronService["retryXeroInvoiceCreation"]>;
  syncXeroInvoiceWebhookEvent(
    input: Parameters<AccountingReplayCronService["syncXeroInvoiceWebhookEvent"]>[0],
  ): ReturnType<AccountingReplayCronService["syncXeroInvoiceWebhookEvent"]>;
  recordStripeCaptureForPayment(
    paymentId: string,
  ): ReturnType<AccountingReplayCronService["recordStripeCaptureForPayment"]>;
  recordRefundCreditNoteForPayment(
    paymentId: string,
  ): ReturnType<AccountingReplayCronService["recordRefundCreditNoteForPayment"]>;
  acknowledgePayoutSettlement(
    payoutId: string,
  ): ReturnType<AccountingReplayCronService["acknowledgePayoutSettlement"]>;
}
