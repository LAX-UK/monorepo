import { describe, expect, it, vi } from "vitest";

type Processor = () => Promise<void>;
const captured = vi.hoisted(() => ({
  processors: new Map<string, Processor>(),
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
    constructor(queue: string, processor: Processor) {
      captured.processors.set(queue, processor);
    }
    on = vi.fn();
    close = vi.fn(async () => {});
  },
}));
const withMonitor = vi.hoisted(() => vi.fn(async (_slug: string, fn: () => Promise<void>) => fn()));
vi.mock("@auction/observability", () => ({ Sentry: { withMonitor, captureMessage: vi.fn() } }));

import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import {
  ACCOUNTING_RECONCILE_PATTERN,
  ACCOUNTING_RECONCILE_TIME_ZONE,
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
    sentryMonitorSlugs: {
      "accounting-watch": "accounting-watch-cron",
      "accounting-reconcile": "accounting-reconcile-cron",
    },
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
    expect(captured.adds.find((a) => a[0] === "watch")?.[2]).toMatchObject({
      jobId: "accounting-watch-15m",
      repeat: { every: ACCOUNTING_WATCH_EVERY_MS },
    });
    withMonitor.mockClear();
    await captured.processors.get("accounting-watch")?.();
    expect(withMonitor.mock.calls.map(([slug]) => slug)).toEqual(["accounting-watch-cron"]);
    expect(check).toHaveBeenCalledOnce();
    expect(heartbeat).toHaveBeenCalledWith("accounting-watch");
    expect(handle.errorHandlers).toHaveLength(2);
    vi.unstubAllEnvs();
  });

  it("reads Stripe's fees and payouts, then reconciles, daily at 05:30 London under its own cron monitor", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const order: string[] = [];
    const runtime = {
      watch: { check: vi.fn() },
      stripeSync: { run: vi.fn(async () => void order.push("sync")) },
      reconciliation: { run: vi.fn(async () => void order.push("report")) },
    } as unknown as AccountingRuntime;
    registerAccountingWorkers(deps(), runtime);
    expect(captured.queues).toContain("accounting-reconcile");
    expect(captured.adds.find((a) => a[0] === "reconcile")?.[2]).toMatchObject({
      jobId: "accounting-reconcile-daily",
      repeat: { pattern: ACCOUNTING_RECONCILE_PATTERN, tz: ACCOUNTING_RECONCILE_TIME_ZONE },
    });
    expect(ACCOUNTING_RECONCILE_PATTERN).toBe("30 5 * * *");
    expect(ACCOUNTING_RECONCILE_TIME_ZONE).toBe("Europe/London");
    withMonitor.mockClear();
    await captured.processors.get("accounting-reconcile")?.();
    // A missed or failed run is the monitor's alert; the report always follows a finished read.
    expect(withMonitor.mock.calls.map(([slug]) => slug)).toEqual(["accounting-reconcile-cron"]);
    expect(order).toEqual(["sync", "report"]);
    vi.unstubAllEnvs();
  });

  it("does not report when the read fails, so a half-read day is never reconciled", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const report = vi.fn();
    registerAccountingWorkers(deps(), {
      watch: { check: vi.fn() },
      stripeSync: { run: vi.fn(async () => Promise.reject(new Error("stripe down"))) },
      reconciliation: { run: report },
    } as unknown as AccountingRuntime);
    await expect(captured.processors.get("accounting-reconcile")?.()).rejects.toThrow(
      "stripe down",
    );
    expect(report).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
