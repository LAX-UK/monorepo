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

  describe("gateway retry", () => {
    const reply = (status: number) => ({ ok: status < 400, status, text: async () => "" });
    const job = (extra: Partial<Parameters<typeof postInternalCronJob>[0]>) => ({
      apiBaseUrl: "http://api.test",
      cronSecret: "secret",
      path: "watched-lot-reminders",
      log: { warn: vi.fn(), error: vi.fn() } as never,
      wait: vi.fn().mockResolvedValue(undefined),
      ...extra,
    });

    it("asks again after a 504 and completes when the API is back", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(reply(504)).mockResolvedValueOnce(reply(200));
      vi.stubGlobal("fetch", fetchMock);
      const wait = vi.fn().mockResolvedValue(undefined);

      const result = await postInternalCronJob(
        job({ gatewayRetry: { retries: 2, delayMs: 5 }, wait }),
      );

      expect(result).toEqual({ ok: true, outcome: "completed" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(wait).toHaveBeenCalledWith(5);
    });

    it("fails with the status once the retries are used up", async () => {
      const fetchMock = vi.fn().mockResolvedValue(reply(502));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        postInternalCronJob(job({ gatewayRetry: { retries: 2, delayMs: 1 } })),
      ).rejects.toThrow("watched-lot-reminders_failed:502");
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("does not repeat without a retry policy", async () => {
      const fetchMock = vi.fn().mockResolvedValue(reply(504));
      vi.stubGlobal("fetch", fetchMock);

      await expect(postInternalCronJob(job({}))).rejects.toThrow("failed:504");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not repeat other failures", async () => {
      const fetchMock = vi.fn().mockResolvedValue(reply(500));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        postInternalCronJob(job({ gatewayRetry: { retries: 2, delayMs: 1 } })),
      ).rejects.toThrow("failed:500");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
