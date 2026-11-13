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

import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import {
  ACCOUNTING_WATCH_EVERY_MS,
  registerAccountingWorkers,
} from "./register-accounting-workers.js";

function deps(heartbeat = vi.fn(async () => {})) {
  return {
    bullConnection: {},
    heartbeat,
    reportWorkerJobFailure: vi.fn(),
    queueOpts: () => ({}),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    sentryMonitorSlugs: { "accounting-watch": "accounting-watch-cron" },
  } as never;
}

describe("accounting watch cron", () => {
  it("registers nothing when Books is not configured", () => {
    captured.queues.length = 0;
    const handle = registerAccountingWorkers(deps(), undefined);
    expect(handle.errorHandlers).toEqual([]);
    expect(captured.queues).toEqual([]);
  });

  it("runs the watch every 15 minutes under its cron monitor, then beats its heartbeat", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const check = vi.fn(async () => ({ needsPersonOverdue: false, senderMissed: false }));
    const heartbeat = vi.fn(async () => {});
    const handle = registerAccountingWorkers(deps(heartbeat), {
      watch: { check },
    } as unknown as AccountingRuntime);
    expect(captured.queues).toContain("accounting-watch");
    expect(captured.adds.at(-1)?.[2]).toMatchObject({
      jobId: "accounting-watch-15m",
      repeat: { every: ACCOUNTING_WATCH_EVERY_MS },
    });
    await captured.processor?.();
    expect(withMonitor.mock.calls.map(([slug]) => slug)).toEqual(["accounting-watch-cron"]);
    expect(check).toHaveBeenCalledOnce();
    expect(heartbeat).toHaveBeenCalledWith("accounting-watch");
    expect(handle.errorHandlers).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});
