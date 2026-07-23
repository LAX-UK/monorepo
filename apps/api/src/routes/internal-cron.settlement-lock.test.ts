import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { InternalCronApplicationService } from "../services/finance/internal-cron-application.service.js";
import { BULK_PAYOUT_SETTLEMENT_LOCK_KEY, createInternalCronRoutes } from "./internal-cron.js";

function createInMemoryRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: vi.fn(async (key: string, value: string, ...args: (string | number)[]) => {
      const nx = args.includes("NX");
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return "OK" as const;
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

describe("bulk-payout-settlement distributed lock", () => {
  it("returns 409 when a second request runs while the lock is held", async () => {
    const redis = createInMemoryRedis();
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const settlementCronService = {
      runBulkSettlement: vi.fn(async () => {
        await gate;
        return {
          settlement: { eligibleEntityCount: 0, createdCount: 0, items: [] },
          transfers: {
            items: [],
            summary: { totalTransferAttempts: 0, byOutcome: {} },
          },
        };
      }),
    };
    const paymentMaintenanceCronService = {
      expireStalePayments: vi.fn(),
      retryRefundReconciles: vi.fn(),
    };

    const internalCron = new InternalCronApplicationService(
      redis as never,
      settlementCronService as never,
      paymentMaintenanceCronService as never,
    );

    const container = {
      finance: { internalCron },
      platformCron: {
        lifecycle: { runLotLifecycleTickWithLock: vi.fn(), processNotificationOutbox: vi.fn() },
        hygiene: {},
      },
    } as unknown as ContainerInternalCronRoutesSlice;

    const env: Env = {
      CRON_INTERNAL_SECRET: "test-cron-secret",
      LOG_LEVEL: "error",
      NODE_ENV: "test",
    } as Env;
    const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));

    const headers = { "x-cron-secret": "test-cron-secret" };

    const p1 = app.request("/internal/jobs/bulk-payout-settlement", { method: "POST", headers });
    for (let i = 0; i < 200; i++) {
      if (settlementCronService.runBulkSettlement.mock.calls.length > 0) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(settlementCronService.runBulkSettlement).toHaveBeenCalled();

    const p2 = app.request("/internal/jobs/bulk-payout-settlement", { method: "POST", headers });

    const res2 = await p2;
    expect(res2.status).toBe(409);
    await expect(res2.json()).resolves.toEqual({ reason: "settlement_already_running" });

    releaseFirst();
    const res1 = await p1;
    expect(res1.status).toBe(200);

    expect(redis.del).toHaveBeenCalledWith(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
  });

  it("returns 409 when the shared lock is held by another owner (e.g. worker)", async () => {
    const redis = createInMemoryRedis();
    redis.store.set(BULK_PAYOUT_SETTLEMENT_LOCK_KEY, "1");

    const settlementCronService = { runBulkSettlement: vi.fn() };
    const internalCron = new InternalCronApplicationService(
      redis as never,
      settlementCronService as never,
      { expireStalePayments: vi.fn(), retryRefundReconciles: vi.fn() } as never,
    );

    const outcome = await internalCron.runBulkPayoutSettlementWithLock({
      settlementDisabled: false,
    });
    expect(outcome).toEqual({
      ok: false,
      status: 409,
      body: { reason: "settlement_already_running" },
    });
    expect(settlementCronService.runBulkSettlement).not.toHaveBeenCalled();
  });

  it("allows a new run after lock expiry mid-flight while the first settlement is still executing", async () => {
    const redis = createInMemoryRedis();
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const settlementCronService = {
      runBulkSettlement: vi.fn(async () => {
        redis.store.delete(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
        await gate;
        return {
          settlement: { eligibleEntityCount: 0, createdCount: 0, items: [] },
          transfers: {
            items: [],
            summary: { totalTransferAttempts: 0, byOutcome: {} },
          },
        };
      }),
    };
    const internalCron = new InternalCronApplicationService(
      redis as never,
      settlementCronService as never,
      { expireStalePayments: vi.fn(), retryRefundReconciles: vi.fn() } as never,
    );

    const first = internalCron.runBulkPayoutSettlementWithLock({ settlementDisabled: false });
    for (let i = 0; i < 200; i++) {
      if (settlementCronService.runBulkSettlement.mock.calls.length > 0) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(redis.store.has(BULK_PAYOUT_SETTLEMENT_LOCK_KEY)).toBe(false);

    const secondPromise = internalCron.runBulkPayoutSettlementWithLock({
      settlementDisabled: false,
    });
    for (let i = 0; i < 200; i++) {
      if (settlementCronService.runBulkSettlement.mock.calls.length >= 2) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    releaseFirst();
    const second = await secondPromise;
    expect(second.ok).toBe(true);
    await first;
  });
});
