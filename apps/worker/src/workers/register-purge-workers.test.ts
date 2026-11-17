import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  adds: [] as { queue: string; args: unknown[] }[],
  removals: [] as { queue: string; args: unknown[] }[],
}));
vi.mock("bullmq", () => ({
  Queue: class {
    constructor(private readonly name: string) {}
    add = vi.fn(async (...args: unknown[]) => {
      captured.adds.push({ queue: this.name, args });
      return {};
    });
    removeRepeatable = vi.fn(async (...args: unknown[]) => {
      captured.removals.push({ queue: this.name, args });
      return true;
    });
    close = vi.fn(async () => {});
  },
  Worker: class {
    on = vi.fn();
    close = vi.fn(async () => {});
  },
}));

import { PURGE_FAILED_JOB_PAYLOADS_QUEUE_NAME } from "@auction/queues";
import { registerPurgeWorkers } from "./register-purge-workers.js";

function register() {
  const deps = {
    env: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    bullConnection: {},
    queueOpts: () => ({}),
    sentryMonitorSlugs: {},
    reportWorkerJobFailure: vi.fn(),
  } as never;
  return registerPurgeWorkers(deps, { retentionHoldAlerts: {} as never });
}

describe("purge-failed-job-payloads schedule", () => {
  it("repeats daily at 02:00 UTC with the fixed cron pattern", () => {
    captured.adds.length = 0;
    register();
    const add = captured.adds.find((a) => a.queue === PURGE_FAILED_JOB_PAYLOADS_QUEUE_NAME);
    expect(add?.args[2]).toMatchObject({
      jobId: "purge-failed-job-payloads-daily",
      repeat: { pattern: "0 2 * * *", tz: "UTC" },
    });
    expect((add?.args[2] as { repeat: object }).repeat).not.toHaveProperty("every");
  });

  it("removes the old every-24h repeat under the same job id", () => {
    captured.removals.length = 0;
    register();
    const removal = captured.removals.find((r) => r.queue === PURGE_FAILED_JOB_PAYLOADS_QUEUE_NAME);
    expect(removal?.args).toEqual([
      "purge",
      { every: 24 * 60 * 60 * 1000 },
      "purge-failed-job-payloads-daily",
    ]);
  });
});
