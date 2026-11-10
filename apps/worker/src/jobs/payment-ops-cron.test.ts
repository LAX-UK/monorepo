import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runEnsureLotInvoicesJob,
  runExpireStalePaymentsJob,
  runProcessNotificationOutboxJob,
  runRetryXeroInvoiceCreationJob,
  runRetryXeroStripeCaptureSyncJob,
} from "./payment-ops-cron.js";

const reply = (status: number) => ({ ok: status < 400, status, text: async () => "" });

const jobOpts = () =>
  ({
    env: {
      FINANCE_CRON_EXECUTION_OWNER: "api_rollback",
      FINANCE_CRON_API_ROLLBACK: true,
      API_INTERNAL_BASE_URL: "http://api.test",
    },
    cronSecret: "secret",
    log: { warn: vi.fn(), error: vi.fn() },
    financeCron: {
      env: {
        FINANCE_CRON_EXECUTION_OWNER: "api_rollback",
        FINANCE_CRON_API_ROLLBACK: true,
        API_INTERNAL_BASE_URL: "http://api.test",
      },
      log: { warn: vi.fn(), error: vi.fn() },
      cronSecret: "secret",
      handlers: null,
    },
  }) as never;

describe("payment operations cron jobs behind the API proxy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const repeatable = [
    ["expire-stale-payments", runExpireStalePaymentsJob],
    ["retry-xero-stripe-capture-sync", runRetryXeroStripeCaptureSyncJob],
    ["process-notification-outbox", runProcessNotificationOutboxJob],
    ["ensure-lot-invoices", runEnsureLotInvoicesJob],
  ] as const;

  it.each(repeatable)("asks %s again after a deploy-time 504", async (path, run) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(504)).mockResolvedValueOnce(reply(200));
    vi.stubGlobal("fetch", fetchMock);

    const done = run(jobOpts());
    await vi.advanceTimersByTimeAsync(15_000);
    await done;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `http://api.test/internal/jobs/${path}`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("gives up after two repeats and fails the run", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(502));
    vi.stubGlobal("fetch", fetchMock);

    const done = runProcessNotificationOutboxJob(jobOpts());
    const failed = expect(done).rejects.toThrow("process-notification-outbox_failed:502");
    await vi.advanceTimersByTimeAsync(30_000);
    await failed;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not repeat a job that has not been checked as safe to repeat", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(504));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runRetryXeroInvoiceCreationJob(jobOpts())).rejects.toThrow("failed:504");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not repeat on an ordinary server error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runExpireStalePaymentsJob(jobOpts())).rejects.toThrow("failed:500");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
