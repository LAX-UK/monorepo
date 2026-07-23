import { describe, expect, it, vi } from "vitest";
import {
  BULK_PAYOUT_SETTLEMENT_LOCK_KEY,
  runWorkerBulkPayoutSettlement,
} from "./worker-bulk-payout-settlement.js";

describe("runWorkerBulkPayoutSettlement", () => {
  const env = {
    NODE_ENV: "test",
    DISABLE_PAYOUT_SETTLEMENT: false,
    STRIPE_SECRET_KEY: "sk_test",
  } as const;

  it("returns skipped when settlement lock is held (e.g. API peer holds shared key)", async () => {
    const redis = {
      set: vi.fn().mockResolvedValue(null),
      del: vi.fn(),
    };
    const result = await runWorkerBulkPayoutSettlement({
      env: env as never,
      redis: redis as never,
      log: { child: () => ({ info: vi.fn() }), warn: vi.fn() } as never,
      settlement: {
        runtime: { runBulkSettlementWithTransfers: vi.fn() },
      } as never,
    });
    expect(result).toEqual({ skipped: true, reason: "settlement_already_running" });
    expect(redis.set).toHaveBeenCalledWith(
      BULK_PAYOUT_SETTLEMENT_LOCK_KEY,
      "1",
      "EX",
      expect.any(Number),
      "NX",
    );
    expect(redis.del).not.toHaveBeenCalled();
  });

  it("runs settlement and releases lock on success", async () => {
    const bulk = {
      settlement: { eligibleEntityCount: 0, createdCount: 0, items: [] },
      transfers: { attempted: 0, succeeded: 0, outcomes: [] },
    };
    const runBulkSettlementWithTransfers = vi.fn().mockResolvedValue(bulk);
    const redis = {
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };
    const result = await runWorkerBulkPayoutSettlement({
      env: env as never,
      redis: redis as never,
      log: { child: () => ({ info: vi.fn() }), warn: vi.fn() } as never,
      settlement: {
        runtime: { runBulkSettlementWithTransfers },
      } as never,
    });
    expect(result).toEqual(bulk);
    expect(runBulkSettlementWithTransfers).toHaveBeenCalledOnce();
    expect(redis.del).toHaveBeenCalledWith(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
  });

  it("throws when settlement is disabled", async () => {
    await expect(
      runWorkerBulkPayoutSettlement({
        env: { ...env, DISABLE_PAYOUT_SETTLEMENT: true } as never,
        redis: { set: vi.fn(), del: vi.fn() } as never,
        log: { child: () => ({ info: vi.fn() }), warn: vi.fn() } as never,
        settlement: { runtime: {} } as never,
      }),
    ).rejects.toThrow("payout_settlement_disabled");
  });
});
