import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { Env } from "../env.js";
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

    const payoutService = {
      runBulkSettlement: vi.fn(async () => {
        await gate;
        return { eligibleEntityCount: 0, createdCount: 0, items: [] };
      }),
      adminList: vi.fn().mockResolvedValue([]),
    };

    const stripeConnectService = { initiateTransfer: vi.fn() };

    const container = {
      redis,
      payoutService,
      stripeConnectService,
    } as unknown as Container;

    const env: Env = { CRON_INTERNAL_SECRET: "test-cron-secret" } as Env;
    const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));

    const headers = { "x-cron-secret": "test-cron-secret" };

    const p1 = app.request("/internal/jobs/bulk-payout-settlement", { method: "POST", headers });
    for (let i = 0; i < 200; i++) {
      if (payoutService.runBulkSettlement.mock.calls.length > 0) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(payoutService.runBulkSettlement).toHaveBeenCalled();

    const p2 = app.request("/internal/jobs/bulk-payout-settlement", { method: "POST", headers });

    const res2 = await p2;
    expect(res2.status).toBe(409);
    await expect(res2.json()).resolves.toEqual({ reason: "settlement_already_running" });

    releaseFirst();
    const res1 = await p1;
    expect(res1.status).toBe(200);

    expect(redis.del).toHaveBeenCalledWith(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
  });
});
