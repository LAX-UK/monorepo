import { describe, expect, it, vi } from "vitest";

type Processor = () => Promise<void>;
const captured = vi.hoisted(() => ({
  processor: null as Processor | null,
  queues: [] as string[],
  adds: [] as unknown[][],
}));
vi.mock("bullmq", () => ({
  Queue: class {
    constructor(name: string) {
      captured.queues.push(name);
    }
    add = vi.fn(async (...args: unknown[]) => {
      captured.adds.push(args);
      return {};
    });
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
vi.mock("@auction/observability", () => ({ Sentry: { withMonitor, captureMessage: vi.fn() } }));

import { FAILED_JOBS_WATCH_QUEUE_NAME, QUEUE_REGISTRY } from "@auction/queues";
import { FAILED_JOBS_CRON_MONITORS } from "../ops/failed-jobs/failed-jobs-watch.service.js";
import {
  FAILED_JOBS_WATCH_PATTERN,
  FAILED_JOBS_WATCH_TIME_ZONE,
  registerFailedJobsWatchWorker,
} from "./register-failed-jobs-watch-worker.js";

function deps() {
  return {
    bullConnection: {},
    heartbeat: vi.fn(async () => {}),
    reportWorkerJobFailure: vi.fn(),
    queueOpts: () => ({}),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sentryMonitorSlugs: { "failed-jobs-watch": "failed-jobs-watch-cron" },
  } as never;
}

describe("Failed jobs watch cron", () => {
  it("is a registered daily queue with no heartbeat, consumed by the worker", () => {
    expect(FAILED_JOBS_WATCH_QUEUE_NAME).toBe("failed-jobs-watch");
    expect(QUEUE_REGISTRY[FAILED_JOBS_WATCH_QUEUE_NAME]).toMatchObject({
      producers: ["worker"],
      consumer: "worker",
      heartbeatKey: null,
      repeatable: true,
    });
    expect(FAILED_JOBS_CRON_MONITORS.watch).toBe("failed-jobs-watch");
  });

  it("runs the watch every day at 08:00 London under its cron monitor", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const check = vi.fn(async () => null);
    const handle = registerFailedJobsWatchWorker(deps(), { check });
    expect(captured.queues).toEqual(["failed-jobs-watch"]);
    expect(FAILED_JOBS_WATCH_PATTERN).toBe("0 8 * * *");
    expect(FAILED_JOBS_WATCH_TIME_ZONE).toBe("Europe/London");
    expect(captured.adds.at(-1)?.[2]).toMatchObject({
      jobId: "failed-jobs-watch-daily-0800-london",
      repeat: { pattern: "0 8 * * *", tz: "Europe/London" },
    });
    await captured.processor?.();
    expect(withMonitor.mock.calls.map(([slug]) => slug)).toEqual(["failed-jobs-watch-cron"]);
    expect(check).toHaveBeenCalledOnce();
    expect(handle.errorHandlers).toEqual([expect.objectContaining({ queue: "failed-jobs-watch" })]);
    await handle.close();
    vi.unstubAllEnvs();
  });

  it("fails the job, so the monitor sees the failure, when the watch throws", async () => {
    const check = vi.fn(async () => {
      throw new Error("db down");
    });
    registerFailedJobsWatchWorker(deps(), { check });
    await expect(captured.processor?.()).rejects.toThrow("db down");
  });
});
