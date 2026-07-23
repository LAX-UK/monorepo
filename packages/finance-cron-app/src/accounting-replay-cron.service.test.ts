import { describe, expect, it, vi } from "vitest";
import { AccountingReplayCronService } from "./accounting-replay-cron.service.js";

describe("AccountingReplayCronService", () => {
  it("skips duplicate xero webhook claims", async () => {
    const xeroWebhookEventRepository = {
      tryClaimEvent: vi.fn().mockResolvedValue({ claimed: false }),
      markFailed: vi.fn(),
      markProcessed: vi.fn(),
      listRecentFailures: vi.fn(),
    };
    const svc = new AccountingReplayCronService(
      { listPendingStripeCaptureSync: vi.fn(), listPaymentsMissingXeroInvoice: vi.fn() },
      xeroWebhookEventRepository,
      { isConfigured: () => true, syncInvoiceFromProvider: vi.fn() },
      null,
      { backfillXeroInvoiceForPayment: vi.fn() },
      { findById: vi.fn() },
      { findById: vi.fn() },
      { isConfigured: () => true, refresh: vi.fn() },
    );

    await expect(
      svc.syncXeroInvoiceWebhookEvent({
        tenantId: "t",
        resourceId: "r",
        eventKey: "k",
      }),
    ).resolves.toEqual({ ok: true, skipped: true });
    expect(xeroWebhookEventRepository.markProcessed).not.toHaveBeenCalled();
  });
});
