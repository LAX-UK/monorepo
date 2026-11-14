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

  it("runs the Books status check nightly at 02:15 London under its own cron monitor, then beats", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const runNightly = vi.fn(async () => ({ outcome: "completed" }));
    const heartbeat = vi.fn(async () => {});
    registerAccountingWorkers(deps(heartbeat), {
      watch: { check: vi.fn() },
      statusCheck: { runNightly },
    } as unknown as AccountingRuntime);
    expect(captured.queues).toContain("accounting-reconcile");
    expect(ACCOUNTING_RECONCILE_PATTERN).toBe("15 2 * * *");
    expect(captured.adds.find((a) => a[0] === "reconcile")?.[2]).toMatchObject({
      jobId: "accounting-reconcile-nightly",
      repeat: { pattern: "15 2 * * *", tz: "Europe/London" },
    });
    withMonitor.mockClear();
    await captured.processors.get("accounting-reconcile")?.();
    expect(withMonitor.mock.calls.map(([slug]) => slug)).toEqual(["accounting-reconcile-cron"]);
    expect(runNightly).toHaveBeenCalledOnce();
    expect(heartbeat).toHaveBeenCalledWith("accounting-reconcile");
    vi.unstubAllEnvs();
  });

  it("a failed nightly run beats no heartbeat, so the monitor and the watch see it missed", async () => {
    vi.stubEnv("SENTRY_DSN_WORKER", "https://key@o0.ingest.sentry.io/1");
    const heartbeat = vi.fn(async () => {});
    registerAccountingWorkers(deps(heartbeat), {
      watch: { check: vi.fn() },
      statusCheck: { runNightly: vi.fn(async () => Promise.reject(new Error("books down"))) },
    } as unknown as AccountingRuntime);
    await expect(captured.processors.get("accounting-reconcile")?.()).rejects.toThrow("books down");
    expect(heartbeat).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
