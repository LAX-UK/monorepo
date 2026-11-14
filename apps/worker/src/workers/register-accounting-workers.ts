import { ACCOUNTING_RECONCILE_QUEUE_NAME, ACCOUNTING_WATCH_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { ACCOUNTING_CRON_MONITORS } from "../finance/accounting/accounting-alerts.js";
import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** How often the Books queue is checked; also the interval its cron monitor expects. */
export const ACCOUNTING_WATCH_EVERY_MS = 15 * 60_000;

/**
 * The nightly Books status check: 02:15 London, after the day's sending and before staff start.
 * Its Sentry cron monitor (`accounting-reconcile`) expects this schedule; a miss is the alert, and
 * the accounting watch raises `accounting_status_check_missed` after 26 hours without a run.
 */
export const ACCOUNTING_RECONCILE_PATTERN = "15 2 * * *";
export const ACCOUNTING_RECONCILE_TIME_ZONE = "Europe/London";

export type AccountingWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

/**
 * The accounting watch cron: every 15 minutes, with a heartbeat and a Sentry cron monitor like the
 * other finance crons. Registered only when the accounting runtime is built (Books configured).
 */
export function registerAccountingWorkers(
  deps: WorkerBootstrapDeps,
  accounting: AccountingRuntime | undefined,
): AccountingWorkersHandle {
  if (!accounting) return { errorHandlers: [], close: async () => {} };
  const { log, bullConnection, queueOpts, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } =
    deps;
  const queue = new Queue(ACCOUNTING_WATCH_QUEUE_NAME, queueOpts(ACCOUNTING_WATCH_QUEUE_NAME));
  const worker = new Worker(
    ACCOUNTING_WATCH_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(ACCOUNTING_CRON_MONITORS.watch, sentryMonitorSlugs, async () => {
        await accounting.watch.check();
        await heartbeat(ACCOUNTING_WATCH_QUEUE_NAME);
      });
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => reportWorkerJobFailure(ACCOUNTING_WATCH_QUEUE_NAME, job, err));
  void queue.add(
    "watch",
    {},
    {
      jobId: "accounting-watch-15m",
      repeat: { every: ACCOUNTING_WATCH_EVERY_MS },
      removeOnComplete: 50,
    },
  );
  log.info(
    `${ACCOUNTING_WATCH_QUEUE_NAME} repeat registered (every ${ACCOUNTING_WATCH_EVERY_MS}ms)`,
  );

  const reconcileQueue = new Queue(
    ACCOUNTING_RECONCILE_QUEUE_NAME,
    queueOpts(ACCOUNTING_RECONCILE_QUEUE_NAME),
  );
  const reconcileWorker = new Worker(
    ACCOUNTING_RECONCILE_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        ACCOUNTING_CRON_MONITORS.reconcile,
        sentryMonitorSlugs,
        async () => {
          await accounting.statusCheck.runNightly();
          await heartbeat(ACCOUNTING_RECONCILE_QUEUE_NAME);
        },
      );
    },
    // One run at a time: a retry never overlaps a run still reading.
    { ...bullConnection, concurrency: 1 },
  );
  reconcileWorker.on("failed", (job, err) =>
    reportWorkerJobFailure(ACCOUNTING_RECONCILE_QUEUE_NAME, job, err),
  );
  void reconcileQueue.add(
    "reconcile",
    {},
    {
      jobId: "accounting-reconcile-nightly",
      repeat: { pattern: ACCOUNTING_RECONCILE_PATTERN, tz: ACCOUNTING_RECONCILE_TIME_ZONE },
      removeOnComplete: 30,
    },
  );
  log.info(
    `${ACCOUNTING_RECONCILE_QUEUE_NAME} repeat registered (${ACCOUNTING_RECONCILE_PATTERN} ${ACCOUNTING_RECONCILE_TIME_ZONE})`,
  );
  return {
    errorHandlers: [
      { worker, queue: ACCOUNTING_WATCH_QUEUE_NAME },
      { worker: reconcileWorker, queue: ACCOUNTING_RECONCILE_QUEUE_NAME },
    ],
    close: () => closeAll([worker, queue, reconcileWorker, reconcileQueue]),
  };
}
