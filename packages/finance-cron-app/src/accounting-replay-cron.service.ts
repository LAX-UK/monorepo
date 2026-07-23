import type {
  IPaymentRefundReconcileRepository,
  IPaymentWriteRepository,
  IPayoutRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type {
  IAccountingReplayInvoiceProvider,
  IAccountingReplayPaymentMaintenance,
  IAccountingReplayPaymentRecorder,
  IXeroProactiveTokenRefresher,
} from "./accounting-replay-ports.js";

export class AccountingReplayCronService {
  constructor(
    private readonly paymentRefundReconcileRepository: IPaymentRefundReconcileRepository,
    private readonly xeroWebhookEventRepository: IXeroWebhookEventRepository,
    private readonly accountingProvider: IAccountingReplayInvoiceProvider,
    private readonly xeroPaymentRecorder: IAccountingReplayPaymentRecorder | null,
    private readonly paymentMaintenance: IAccountingReplayPaymentMaintenance,
    private readonly payments: IPaymentWriteRepository,
    private readonly payouts: IPayoutRepository,
    private readonly xeroTokenRefresher: IXeroProactiveTokenRefresher,
  ) {}

  async syncXeroInvoiceWebhookEvent(input: {
    tenantId: string;
    resourceId: string;
    eventKey: string;
  }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    const { claimed } = await this.xeroWebhookEventRepository.tryClaimEvent({
      tenantId: input.tenantId,
      resourceType: "INVOICE",
      resourceId: input.resourceId,
      eventKey: input.eventKey,
    });
    if (!claimed) {
      return { ok: true, skipped: true };
    }

    const sync = await this.accountingProvider.syncInvoiceFromProvider(
      input.tenantId,
      input.resourceId,
    );
    if (!sync.ok) {
      await this.xeroWebhookEventRepository.markFailed(input.eventKey, sync.error ?? "sync failed");
      return { ok: false, error: sync.error ?? "sync failed" };
    }
    await this.xeroWebhookEventRepository.markProcessed(input.eventKey);
    return { ok: true };
  }

  async recordStripeCaptureForPayment(paymentId: string) {
    if (!this.xeroPaymentRecorder) {
      return { ok: false as const, error: "xero_payment_recorder_disabled" };
    }
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      return { ok: false as const, error: "payment_not_found" };
    }
    if (payment.status !== "captured") {
      return { ok: false as const, error: "payment_not_captured" };
    }
    const result = await this.xeroPaymentRecorder.recordStripeCapture(paymentId, payment.amount);
    if (!result.ok) {
      return { ok: false as const, error: result.error ?? "xero_capture_sync_failed" };
    }
    return { ok: true as const };
  }

  async recordRefundCreditNoteForPayment(paymentId: string) {
    if (!this.xeroPaymentRecorder) {
      return { ok: false as const, error: "xero_payment_recorder_disabled" };
    }
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      return { ok: false as const, error: "payment_not_found" };
    }
    if (payment.status !== "refunded") {
      return { ok: false as const, error: "payment_not_refunded" };
    }
    const reference = payment.stripeRefundId ?? `refund:${paymentId}`;
    const result = await this.xeroPaymentRecorder.recordRefundCreditNote(
      paymentId,
      payment.amount,
      reference,
    );
    if (!result.ok) {
      return { ok: false as const, error: result.error ?? "xero_refund_sync_failed" };
    }
    return { ok: true as const };
  }

  async acknowledgePayoutSettlement(payoutId: string) {
    const payout = await this.payouts.findById(payoutId);
    if (!payout) {
      return { ok: false as const, error: "payout_not_found" };
    }
    return { ok: true as const, data: { acknowledged: true, payoutId } };
  }

  async retryXeroWebhookFailures() {
    const rows = await this.xeroWebhookEventRepository.listRecentFailures(25);
    let recovered = 0;
    for (const row of rows) {
      const sync = await this.accountingProvider.syncInvoiceFromProvider(
        row.tenantId,
        row.resourceId,
      );
      if (sync.ok) {
        await this.xeroWebhookEventRepository.markProcessed(row.eventKey);
        recovered += 1;
      } else {
        await this.xeroWebhookEventRepository.markFailed(
          row.eventKey,
          sync.error ?? "retry_failed",
        );
      }
    }
    return { attempted: rows.length, recovered };
  }

  async refreshXeroTokens() {
    if (!this.xeroTokenRefresher.isConfigured()) {
      return { ok: false as const, error: "xero_not_configured" };
    }
    const result = await this.xeroTokenRefresher.refresh();
    if (!result.ok) {
      return {
        ok: false as const,
        result: result.result,
        status: result.status ?? (result.error === "not_connected" ? 200 : 502),
        error: result.error,
      };
    }
    return { ok: true as const, result: result.result };
  }

  async retryXeroStripeCaptureSync() {
    if (!this.xeroPaymentRecorder) {
      return { ok: false as const, error: "xero_payment_recorder_disabled" };
    }
    const rows = await this.paymentRefundReconcileRepository.listPendingStripeCaptureSync(25);
    let synced = 0;
    for (const row of rows) {
      const result = await this.xeroPaymentRecorder.recordStripeCapture(row.paymentId, row.amount);
      if (result.ok) synced += 1;
    }
    return { ok: true as const, data: { attempted: rows.length, synced } };
  }

  async retryXeroInvoiceCreation() {
    if (!this.accountingProvider.isConfigured()) {
      return { ok: false as const, error: "xero_not_configured" };
    }
    const rows = await this.paymentRefundReconcileRepository.listPaymentsMissingXeroInvoice(25);
    let created = 0;
    for (const row of rows) {
      const result = await this.paymentMaintenance.backfillXeroInvoiceForPayment(row.paymentId);
      if (result.ok) created += 1;
    }
    return { ok: true as const, data: { attempted: rows.length, created } };
  }
}
