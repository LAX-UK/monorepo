import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

function minimalContainer(): ContainerInternalCronRoutesSlice {
  return {
    finance: {
      internalCron: {
        expireStalePayments: vi.fn().mockResolvedValue({ expired: 0 }),
        retryRefundReconciles: vi.fn().mockResolvedValue({ attempted: 0, reconciled: 0 }),
        runBulkPayoutSettlementWithLock: vi.fn().mockResolvedValue({
          ok: true,
          data: { settlement: {}, transfers: {} },
        }),
        syncXeroPayoutBill: vi.fn(),
      },
      accountingCron: {
        refreshXeroTokens: vi.fn().mockResolvedValue({ ok: true, result: {} }),
        retryXeroWebhookFailures: vi.fn().mockResolvedValue({ retried: 0 }),
        retryXeroStripeCaptureSync: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        retryXeroInvoiceCreation: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        syncXeroInvoiceWebhookEvent: vi.fn().mockResolvedValue({ ok: true }),
        recordStripeCaptureForPayment: vi.fn().mockResolvedValue({ ok: true }),
        recordRefundCreditNoteForPayment: vi.fn().mockResolvedValue({ ok: true }),
        acknowledgePayoutSettlement: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      },
      settlementCron: {
        ensureLotInvoices: vi.fn().mockResolvedValue({ processed: 0 }),
        ensureLotInvoice: vi.fn().mockResolvedValue({ created: false }),
      },
    },
    platformCron: {
      lifecycle: { processNotificationOutbox: vi.fn().mockResolvedValue({ drained: 0 }) },
      hygiene: {
        cleanupDisplayPairings: vi.fn().mockResolvedValue({ expiredPending: 0, purged: 0 }),
      },
    },
    absenteeBidService: { replayScheduledForLot: vi.fn() },
  } as unknown as ContainerInternalCronRoutesSlice;
}

const CRON_SECRET = "test-cron-secret";

const FINANCE_CRON_ROUTES: Array<{
  path: string;
  method?: "POST";
  body?: Record<string, unknown>;
}> = [
  { path: "bulk-payout-settlement" },
  { path: "xero-payout-bill", body: { payoutId: "00000000-0000-4000-8000-000000000001" } },
  { path: "expire-stale-payments" },
  { path: "retry-xero-webhook-failures" },
  { path: "refresh-xero-tokens" },
  { path: "retry-refund-reconciles" },
  { path: "retry-xero-stripe-capture-sync" },
  { path: "retry-xero-invoice-creation" },
  {
    path: "xero-sync-invoice-webhook",
    body: { tenantId: "t", resourceId: "r", eventKey: "k" },
  },
  {
    path: "xero-record-stripe-capture",
    body: { paymentId: "00000000-0000-4000-8000-000000000002" },
  },
  {
    path: "xero-record-refund-credit-note",
    body: { paymentId: "00000000-0000-4000-8000-000000000003" },
  },
  {
    path: "xero-acknowledge-payout-settlement",
    body: { payoutId: "00000000-0000-4000-8000-000000000004" },
  },
  { path: "process-notification-outbox" },
  { path: "cleanup-display-pairings" },
  { path: "ensure-lot-invoices" },
];

function appForEnv(envPartial: Partial<Env>) {
  const env = {
    CRON_INTERNAL_SECRET: CRON_SECRET,
    FINANCE_CRON_EXECUTION_OWNER: "api_rollback",
    PAYMENT_PENDING_EXPIRE_DAYS: 14,
    PAYMENT_AUTHORIZED_EXPIRE_DAYS: 30,
    DISABLE_PAYOUT_SETTLEMENT: false,
    ...envPartial,
  } as Env;
  return new Hono().route("/internal/jobs", createInternalCronRoutes(minimalContainer(), env));
}

describe("finance cron API delegation guard", () => {
  it.each(FINANCE_CRON_ROUTES.map((r) => [r.path, r.body ?? null] as const))(
    "returns 409 for %s when worker owns finance cron",
    async (path, body) => {
      const app = appForEnv({ FINANCE_CRON_EXECUTION_OWNER: "worker" });
      const res = await app.request(`/internal/jobs/${path}`, {
        method: "POST",
        headers: {
          "x-cron-secret": CRON_SECRET,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toEqual({
        error: "finance_cron_execution_delegated_to_worker",
      });
    },
  );

  it("allows bulk-payout-settlement under api_rollback", async () => {
    const app = appForEnv({ FINANCE_CRON_EXECUTION_OWNER: "api_rollback" });
    const res = await app.request("/internal/jobs/bulk-payout-settlement", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
  });
});
