import { afterEach, describe, expect, it, vi } from "vitest";

const withMonitor = vi.hoisted(() => vi.fn(async (_slug: string, fn: () => Promise<void>) => fn()));
vi.mock("@auction/observability", () => ({ Sentry: { withMonitor } }));

import { throttledCronMonitor, withSentryCronMonitor } from "./sentry-cron.js";

describe("withSentryCronMonitor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    withMonitor.mockClear();
  });

  it("checks in under the configured slug when Sentry is on", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const run = vi.fn(async () => {});
    await withSentryCronMonitor(
      "zoho-artwork-nightly-check",
      { "zoho-artwork-nightly-check": "zoho-inbound" },
      run,
    );
    expect(withMonitor).toHaveBeenCalledWith("zoho-inbound", run);
    expect(run).toHaveBeenCalledOnce();
  });

  it("just runs the job without a DSN", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "");
    const run = vi.fn(async () => {});
    await withSentryCronMonitor(
      "zoho-artwork-nightly-check",
      { "zoho-artwork-nightly-check": "zoho-inbound" },
      run,
    );
    expect(withMonitor).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
  });

  it("just runs the job when the monitor has no slug", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const run = vi.fn(async () => {});
    await withSentryCronMonitor("zoho-artwork-nightly-check", {}, run);
    expect(withMonitor).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
  });
});

describe("throttledCronMonitor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    withMonitor.mockClear();
  });

  it("checks in at most once per interval and runs every call", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    let now = 0;
    const checkIn = throttledCronMonitor(
      "accounting-sender",
      { "accounting-sender": "accounting-sender-slug" },
      1000,
      () => now,
    );
    const run = vi.fn(async () => {});
    await checkIn(run);
    now = 500;
    await checkIn(run);
    now = 1000;
    await checkIn(run);
    expect(run).toHaveBeenCalledTimes(3);
    expect(withMonitor).toHaveBeenCalledTimes(2);
    expect(withMonitor.mock.calls[0]?.[0]).toBe("accounting-sender-slug");
  });
});
