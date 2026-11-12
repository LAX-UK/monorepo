import { afterEach, describe, expect, it, vi } from "vitest";

const withMonitor = vi.hoisted(() => vi.fn(async (_slug: string, fn: () => Promise<void>) => fn()));
vi.mock("@auction/observability", () => ({ Sentry: { withMonitor } }));

import { withSentryCronMonitor } from "./sentry-cron.js";

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
