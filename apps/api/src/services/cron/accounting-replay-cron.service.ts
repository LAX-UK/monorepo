import type { Database } from "@auction/db";
import type { Redis } from "ioredis";
import type { Env } from "../../env.js";
import { proactiveRefreshXeroTokens } from "../accounting/xero-auth-runtime.js";
import type { IXeroPaymentRecorder } from "../accounting/xero-payment-recorder.js";
import type { IInvoiceAccountingProvider } from "../interfaces/invoice-accounting.js";
import type { IPaymentMaintenanceService } from "../interfaces/payment-service.js";
import type { IXeroWebhookEventRepository } from "../interfaces/xero-repositories.js";

export class AccountingReplayCronService {
  constructor(
    private readonly db: Database,
    private readonly redis: Redis,
    private readonly env: Env,
    private readonly xeroWebhookEventRepository: IXeroWebhookEventRepository,
    private readonly accountingProvider: IInvoiceAccountingProvider,
    private readonly xeroPaymentRecorder: IXeroPaymentRecorder | null,
    private readonly paymentMaintenanceService: IPaymentMaintenanceService,
  ) {}

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
    if (!this.env.XERO_CLIENT_ID || !this.env.XERO_CLIENT_SECRET || !this.env.XERO_REDIRECT_URI) {
      return { ok: false as const, error: "xero_not_configured" };
    }
    const { DrizzleXeroConnectionRepository } = await import(
      "../../repositories/drizzle-xero-connection.repository.js"
    );
    const connections = new DrizzleXeroConnectionRepository(this.db);
    const result = await proactiveRefreshXeroTokens({
      env: this.env,
      connections,
      redis: this.redis,
    });
    if (!result.ok) {
      return { ok: false as const, result, status: result.reason === "not_connected" ? 200 : 502 };
    }
    return { ok: true as const, result };
  }

  async retryXeroStripeCaptureSync() {
    if (!this.xeroPaymentRecorder) {
      return { ok: false as const, error: "xero_payment_recorder_disabled" };
    }
    const { listPendingStripeCaptureSync } = await import("@auction/persistence");
    const rows = await listPendingStripeCaptureSync(this.db, 25);
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
    const { listPaymentsMissingXeroInvoice } = await import("@auction/persistence");
    const rows = await listPaymentsMissingXeroInvoice(this.db, 25);
    let created = 0;
    for (const row of rows) {
      const result = await this.paymentMaintenanceService.backfillXeroInvoiceForPayment(
        row.paymentId,
      );
      if (result.ok) created += 1;
    }
    return { ok: true as const, data: { attempted: rows.length, created } };
  }
}
