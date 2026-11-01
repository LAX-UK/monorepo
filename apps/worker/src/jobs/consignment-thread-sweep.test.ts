import { afterEach, describe, expect, it, vi } from "vitest";
import { runConsignmentThreadSweepJob } from "./consignment-thread-sweep.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("runConsignmentThreadSweepJob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("asks the API to sweep consignment threads, with the cron secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await runConsignmentThreadSweepJob({
      apiBaseUrl: "http://api.test/",
      cronSecret: "secret",
      log: log as never,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/internal/jobs/consignment-thread-sweep",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Cron-Secret": "secret" }),
      }),
    );
    expect(log.info).toHaveBeenCalled();
  });

  it("skips quietly when the API has no cron secret configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(
      runConsignmentThreadSweepJob({
        apiBaseUrl: "http://api.test",
        cronSecret: "secret",
        log: log as never,
      }),
    ).resolves.toBeUndefined();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("fails the job on an API error so it is retried", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }),
    );
    await expect(
      runConsignmentThreadSweepJob({
        apiBaseUrl: "http://api.test",
        cronSecret: "secret",
        log: log as never,
      }),
    ).rejects.toThrow(/consignment-thread-sweep_failed:500/);
  });
});
