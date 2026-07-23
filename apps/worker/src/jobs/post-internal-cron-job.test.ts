import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postInternalCronJob } from "./post-internal-cron-job.js";

describe("postInternalCronJob", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ reason: "settlement_already_running" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns deferred outcome when treat409AsSuccess and settlement lock held", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const result = await postInternalCronJob({
      apiBaseUrl: "http://api.test",
      cronSecret: "secret",
      path: "bulk-payout-settlement",
      log: log as never,
      treat409AsSuccess: true,
    });
    expect(result).toEqual({
      ok: true,
      outcome: "deferred",
      reason: "settlement_already_running",
    });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "settlement_already_running" }),
      "internal_cron_deferred_lock_contention",
    );
  });
});
