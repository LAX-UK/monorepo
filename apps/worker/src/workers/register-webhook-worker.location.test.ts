import { describe, expect, it, vi } from "vitest";

type Processor = (job: { name: string; data?: unknown }) => Promise<void>;
const captured = vi.hoisted(() => ({
  processor: null as Processor | null,
  queues: [] as { add: ReturnType<typeof vi.fn>; removeRepeatable: ReturnType<typeof vi.fn> }[],
}));
vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn(async () => ({}));
    removeRepeatable = vi.fn(async () => true);
    close = vi.fn(async () => {});
    constructor() {
      captured.queues.push(this);
    }
  },
  Worker: class {
    constructor(_queue: string, processor: Processor) {
      captured.processor = processor;
    }
    on = vi.fn();
    close = vi.fn(async () => {});
  },
}));

import { ZOHO_LOCATION_NIGHTLY_JOB_NAME } from "../jobs/zoho-location-reconcile.job.js";
import { registerWebhookWorker } from "./register-webhook-worker.js";

function register(runZohoLocationNightlyCheck?: () => Promise<void>) {
  captured.queues.length = 0;
  registerWebhookWorker({
    bullConnection: {},
    heartbeat: vi.fn(async () => {}),
    reportWorkerJobFailure: vi.fn(),
    queueOpts: () => ({}),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sentryMonitorSlugs: {},
    webhookProcessorDeps: {},
    ...(runZohoLocationNightlyCheck ? { runZohoLocationNightlyCheck } : {}),
  } as never);
  const queue = captured.queues[0];
  if (!queue) throw new Error("no queue");
  return { queue, process: captured.processor as Processor };
}

describe("the Zoho stock location nightly check", () => {
  it("is scheduled at 03:30 London and runs the check when the mode is on", async () => {
    const run = vi.fn(async () => {});
    const { queue, process } = register(run);
    expect(queue.add).toHaveBeenCalledWith(
      ZOHO_LOCATION_NIGHTLY_JOB_NAME,
      { eventKey: ZOHO_LOCATION_NIGHTLY_JOB_NAME },
      expect.objectContaining({
        jobId: ZOHO_LOCATION_NIGHTLY_JOB_NAME,
        repeat: { pattern: "30 3 * * *", tz: "Europe/London" },
      }),
    );
    await process({ name: ZOHO_LOCATION_NIGHTLY_JOB_NAME });
    expect(run).toHaveBeenCalledOnce();
  });

  it("is unscheduled when the mode is off, and fails a job left over from before", async () => {
    const { queue, process } = register();
    expect(queue.removeRepeatable).toHaveBeenCalledWith(
      ZOHO_LOCATION_NIGHTLY_JOB_NAME,
      expect.objectContaining({ jobId: ZOHO_LOCATION_NIGHTLY_JOB_NAME }),
    );
    expect(queue.add).not.toHaveBeenCalledWith(
      ZOHO_LOCATION_NIGHTLY_JOB_NAME,
      expect.anything(),
      expect.anything(),
    );
    await expect(process({ name: ZOHO_LOCATION_NIGHTLY_JOB_NAME })).rejects.toThrow(
      "zoho location nightly check not configured",
    );
  });
});
