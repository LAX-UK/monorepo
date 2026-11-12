import { describe, expect, it, vi } from "vitest";

type Processor = (job: { name: string; data?: unknown }) => Promise<void>;
const captured = vi.hoisted(() => ({ processor: null as Processor | null }));
vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn(async () => ({}));
    removeRepeatable = vi.fn(async () => true);
    close = vi.fn(async () => {});
  },
  Worker: class {
    constructor(_queue: string, processor: Processor) {
      captured.processor = processor;
    }
    on = vi.fn();
    close = vi.fn(async () => {});
  },
}));
const withMonitor = vi.hoisted(() => vi.fn(async (_slug: string, fn: () => Promise<void>) => fn()));
vi.mock("@auction/observability", () => ({ Sentry: { withMonitor } }));

import { ZOHO_ARTWORK_NIGHTLY_JOB_NAME } from "../jobs/zoho-artwork-sync.job.js";
import { ZOHO_LISTING_NIGHTLY_JOB_NAME } from "../jobs/zoho-listing-reconcile.job.js";
import { registerWebhookWorker } from "./register-webhook-worker.js";

function register(slugs: Record<string, string>) {
  const runArtwork = vi.fn(async () => {});
  const runListing = vi.fn(async () => {});
  registerWebhookWorker({
    bullConnection: {},
    heartbeat: vi.fn(async () => {}),
    reportWorkerJobFailure: vi.fn(),
    queueOpts: () => ({}),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sentryMonitorSlugs: slugs,
    webhookProcessorDeps: {},
    runZohoArtworkNightlyCheck: runArtwork,
    runZohoListingNightlyCheck: runListing,
  } as never);
  return { runArtwork, runListing, process: captured.processor as Processor };
}

describe("Zoho nightly checks report to Sentry cron monitors", () => {
  it("checks the inbound sync and the listing check in under their own slugs", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const { runArtwork, runListing, process } = register({
      [ZOHO_ARTWORK_NIGHTLY_JOB_NAME]: "zoho-inbound-nightly",
      [ZOHO_LISTING_NIGHTLY_JOB_NAME]: "zoho-listing-nightly",
    });
    await process({ name: ZOHO_ARTWORK_NIGHTLY_JOB_NAME });
    await process({ name: ZOHO_LISTING_NIGHTLY_JOB_NAME });
    expect(withMonitor.mock.calls.map(([slug]) => slug)).toEqual([
      "zoho-inbound-nightly",
      "zoho-listing-nightly",
    ]);
    expect(runArtwork).toHaveBeenCalledOnce();
    expect(runListing).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
    withMonitor.mockClear();
  });

  it("runs both unmonitored without Sentry", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "");
    const { runArtwork, runListing, process } = register({
      [ZOHO_ARTWORK_NIGHTLY_JOB_NAME]: "zoho-inbound-nightly",
    });
    await process({ name: ZOHO_ARTWORK_NIGHTLY_JOB_NAME });
    await process({ name: ZOHO_LISTING_NIGHTLY_JOB_NAME });
    expect(withMonitor).not.toHaveBeenCalled();
    expect(runArtwork).toHaveBeenCalledOnce();
    expect(runListing).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
});
