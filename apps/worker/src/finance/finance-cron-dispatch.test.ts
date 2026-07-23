import type { IFinanceCronHandlers } from "@auction/finance-cron-app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchFinanceCronJob } from "./finance-cron-dispatch.js";

describe("dispatchFinanceCronJob", () => {
  const envBase = {
    FINANCE_CRON_EXECUTION_OWNER: "api_rollback" as const,
    FINANCE_CRON_API_ROLLBACK: true,
    API_INTERNAL_BASE_URL: "http://api.test",
    PAYMENT_PENDING_EXPIRE_DAYS: 14,
    PAYMENT_AUTHORIZED_EXPIRE_DAYS: 30,
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies to API when execution owner is api_rollback", async () => {
    const handlers: IFinanceCronHandlers = {
      expireStalePayments: vi.fn(),
      retryRefundReconciles: vi.fn(),
      refreshXeroTokens: vi.fn(),
      retryXeroWebhookFailures: vi.fn(),
      retryXeroStripeCaptureSync: vi.fn(),
      retryXeroInvoiceCreation: vi.fn(),
      ensureLotInvoices: vi.fn(),
      processNotificationOutbox: vi.fn(),
      cleanupDisplayPairings: vi.fn(),
      runBulkPayoutSettlement: vi.fn(),
    };
    await dispatchFinanceCronJob(
      {
        env: envBase as never,
        log: { warn: vi.fn(), error: vi.fn() } as never,
        cronSecret: "secret",
        handlers,
      },
      "expire-stale-payments",
    );
    expect(fetch).toHaveBeenCalled();
    expect(handlers.expireStalePayments).not.toHaveBeenCalled();
  });

  it("runs worker handler when owner is worker and rollback is off", async () => {
    const handlers: IFinanceCronHandlers = {
      expireStalePayments: vi.fn().mockResolvedValue({ expired: 1 }),
      retryRefundReconciles: vi.fn(),
      refreshXeroTokens: vi.fn(),
      retryXeroWebhookFailures: vi.fn(),
      retryXeroStripeCaptureSync: vi.fn(),
      retryXeroInvoiceCreation: vi.fn(),
      ensureLotInvoices: vi.fn(),
      processNotificationOutbox: vi.fn(),
      cleanupDisplayPairings: vi.fn(),
      runBulkPayoutSettlement: vi.fn(),
    };
    await dispatchFinanceCronJob(
      {
        env: {
          ...envBase,
          FINANCE_CRON_EXECUTION_OWNER: "worker",
          FINANCE_CRON_API_ROLLBACK: false,
        } as never,
        log: { warn: vi.fn(), error: vi.fn() } as never,
        cronSecret: "secret",
        handlers,
      },
      "expire-stale-payments",
    );
    expect(handlers.expireStalePayments).toHaveBeenCalledWith(14, 30);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws when worker owns finance but handlers are missing", async () => {
    await expect(
      dispatchFinanceCronJob(
        {
          env: {
            ...envBase,
            FINANCE_CRON_EXECUTION_OWNER: "worker",
            FINANCE_CRON_API_ROLLBACK: false,
          } as never,
          log: { warn: vi.fn(), error: vi.fn() } as never,
          cronSecret: "secret",
          handlers: null,
        },
        "bulk-payout-settlement",
      ),
    ).rejects.toThrow("finance_cron_handlers_required_for_worker_owner");
    expect(fetch).not.toHaveBeenCalled();
  });
});
