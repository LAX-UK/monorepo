import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_OUTBOX_WAKE_MAX_BATCHES,
  runProcessNotificationOutboxWakeJob,
} from "./payment-ops-cron.js";

const reply = (status: number) => ({ ok: status < 400, status, text: async () => "" });

function opts(
  owner: "worker" | "api_rollback",
  processNotificationOutbox?: () => Promise<unknown>,
) {
  const env = {
    FINANCE_CRON_EXECUTION_OWNER: owner,
    FINANCE_CRON_API_ROLLBACK: owner !== "worker",
    API_INTERNAL_BASE_URL: "http://api.test",
  };
  const log = { warn: vi.fn(), error: vi.fn() };
  return {
    env,
    cronSecret: "secret",
    log,
    financeCron: {
      env,
      log,
      cronSecret: "secret",
      handlers: processNotificationOutbox ? { processNotificationOutbox } : null,
    },
  } as never;
}

const batch = (processed: number, failed = 0) => ({ processed, failed, pendingDepth: 0 });

describe("runProcessNotificationOutboxWakeJob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drains once when the batch is not full", async () => {
    const drain = vi.fn().mockResolvedValue(batch(1));
    await runProcessNotificationOutboxWakeJob(opts("worker", drain));
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it("keeps draining while batches come back full, counting failures", async () => {
    const drain = vi
      .fn()
      .mockResolvedValueOnce(batch(50))
      .mockResolvedValueOnce(batch(45, 5))
      .mockResolvedValueOnce(batch(3));
    await runProcessNotificationOutboxWakeJob(opts("worker", drain));
    expect(drain).toHaveBeenCalledTimes(3);
  });

  it("stops after the batch cap so one wake cannot hold the queue", async () => {
    const drain = vi.fn().mockResolvedValue(batch(50));
    await runProcessNotificationOutboxWakeJob(opts("worker", drain));
    expect(drain).toHaveBeenCalledTimes(NOTIFICATION_OUTBOX_WAKE_MAX_BATCHES);
  });

  it("propagates a drain error so the job is recorded as failed", async () => {
    const drain = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(runProcessNotificationOutboxWakeJob(opts("worker", drain))).rejects.toThrow(
      "db down",
    );
  });

  it("asks the API once behind the proxy, without waiting on gateway retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(504));
    vi.stubGlobal("fetch", fetchMock);
    await expect(runProcessNotificationOutboxWakeJob(opts("api_rollback"))).rejects.toThrow(
      "process-notification-outbox_failed:504",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.test/internal/jobs/process-notification-outbox",
    );
  });

  it("asks the API once on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    await runProcessNotificationOutboxWakeJob(opts("api_rollback"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
