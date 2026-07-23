import type { AccountingReplayCronService } from "@auction/finance-cron-app";
import type { Env } from "../../env.js";
import { assertXeroApiWritesAllowed } from "../../lib/xero-api-writes-guard.js";
import type { IFinanceAccountingCronApplicationService } from "../interfaces/finance-routes/finance-accounting-cron.js";

export class FinanceAccountingCronApplicationService
  implements IFinanceAccountingCronApplicationService
{
  constructor(
    private readonly accountingReplayCronService: AccountingReplayCronService,
    private readonly env: Pick<Env, "XERO_API_WRITES_DISABLED">,
  ) {}

  retryXeroWebhookFailures() {
    return this.accountingReplayCronService.retryXeroWebhookFailures();
  }

  refreshXeroTokens() {
    return this.accountingReplayCronService.refreshXeroTokens();
  }

  retryXeroStripeCaptureSync() {
    this.assertWritesAllowed();
    return this.accountingReplayCronService.retryXeroStripeCaptureSync();
  }

  retryXeroInvoiceCreation() {
    this.assertWritesAllowed();
    return this.accountingReplayCronService.retryXeroInvoiceCreation();
  }

  syncXeroInvoiceWebhookEvent(
    input: Parameters<AccountingReplayCronService["syncXeroInvoiceWebhookEvent"]>[0],
  ) {
    this.assertWritesAllowed();
    return this.accountingReplayCronService.syncXeroInvoiceWebhookEvent(input);
  }

  recordStripeCaptureForPayment(paymentId: string) {
    this.assertWritesAllowed();
    return this.accountingReplayCronService.recordStripeCaptureForPayment(paymentId);
  }

  recordRefundCreditNoteForPayment(paymentId: string) {
    this.assertWritesAllowed();
    return this.accountingReplayCronService.recordRefundCreditNoteForPayment(paymentId);
  }

  acknowledgePayoutSettlement(payoutId: string) {
    this.assertWritesAllowed();
    return this.accountingReplayCronService.acknowledgePayoutSettlement(payoutId);
  }

  private assertWritesAllowed(): void {
    assertXeroApiWritesAllowed(this.env);
  }
}
