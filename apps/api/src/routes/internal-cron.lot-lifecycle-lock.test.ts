import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { PlatformLifecycleCronApplicationService } from "../services/finance/platform-lifecycle-cron-application.service.js";
import { createInternalCronRoutes } from "./internal-cron.js";

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
    eval: vi.fn(async (_script: string, _numKeys: number, key: string, token: string) => {
      if (store.get(key) === token) {
        store.delete(key);
        return 1;
      }
      return 0;
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

describe("lot-lifecycle-tick distributed lock", () => {
  it("returns 409 when a second request runs while the lock is held", async () => {
    const redis = createInMemoryRedis();
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const lifecycleCronService = {
      runLotLifecycleTick: vi.fn(async () => {
        await gate;
        return { ok: true };
      }),
    };

    const platformCron = {
      lifecycle: new PlatformLifecycleCronApplicationService(
        redis as never,
        lifecycleCronService as never,
      ),
    };

    const container = {
      platformCron,
      finance: {
        internalCron: { runBulkPayoutSettlementWithLock: vi.fn() },
        accountingCron: {},
        settlementCron: {},
      },
      absenteeBidService: { replayScheduledForLot: vi.fn() },
    } as unknown as ContainerInternalCronRoutesSlice;

    const env: Env = {
      CRON_INTERNAL_SECRET: "test-cron-secret",
      LOG_LEVEL: "error",
      NODE_ENV: "test",
    } as Env;
    const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));

    const headers = { "x-cron-secret": "test-cron-secret" };

    const p1 = app.request("/internal/jobs/lot-lifecycle-tick", { method: "POST", headers });
    for (let i = 0; i < 200; i++) {
      if (lifecycleCronService.runLotLifecycleTick.mock.calls.length > 0) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(lifecycleCronService.runLotLifecycleTick).toHaveBeenCalled();

    const p2 = app.request("/internal/jobs/lot-lifecycle-tick", { method: "POST", headers });

    const res2 = await p2;
    expect(res2.status).toBe(409);
    await expect(res2.json()).resolves.toEqual({ reason: "lifecycle_tick_already_running" });

    releaseFirst();
    const res1 = await p1;
    expect(res1.status).toBe(200);

    expect(redis.eval).toHaveBeenCalled();
  });

  it("returns 409 when lifecycle execution is delegated to worker", async () => {
    const redis = createInMemoryRedis();
    const runLotLifecycleTick = vi.fn();
    const platformCron = {
      lifecycle: new PlatformLifecycleCronApplicationService(
        redis as never,
        {
          runLotLifecycleTick,
        } as never,
      ),
    };
    const container = {
      platformCron,
      finance: {
        internalCron: { runBulkPayoutSettlementWithLock: vi.fn() },
        accountingCron: {},
        settlementCron: {},
      },
      absenteeBidService: { replayScheduledForLot: vi.fn() },
    } as unknown as ContainerInternalCronRoutesSlice;

    const env = {
      CRON_INTERNAL_SECRET: "test-cron-secret",
      LOG_LEVEL: "error",
      NODE_ENV: "test",
      LIFECYCLE_EXECUTION_OWNER: "worker",
    } as Env;
    const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
    const res = await app.request("/internal/jobs/lot-lifecycle-tick", {
      method: "POST",
      headers: { "x-cron-secret": "test-cron-secret" },
    });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "lifecycle_execution_delegated_to_worker",
    });
    expect(runLotLifecycleTick).not.toHaveBeenCalled();
  });
});
