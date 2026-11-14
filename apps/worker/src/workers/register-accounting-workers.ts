import {
  ACCOUNTING_BOOKS_STATUS_QUEUE_NAME,
  ACCOUNTING_RECONCILE_QUEUE_NAME,
  ACCOUNTING_WATCH_QUEUE_NAME,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { ACCOUNTING_CRON_MONITORS } from "../finance/accounting/accounting-alerts.js";
import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** How often the Books queue is checked; also the interval its cron monitor expects. */
export const ACCOUNTING_WATCH_EVERY_MS = 15 * 60_000;

/** When the daily Stripe fees and payouts job and the reconciliation report run (London time). */
export const ACCOUNTING_RECONCILE_PATTERN = "30 5 * * *";
export const ACCOUNTING_RECONCILE_TIME_ZONE = "Europe/London";

/**
 * The nightly Books status check: 02:15 London, after the day's sending and before staff start.
 * Its Sentry cron monitor (`accounting-books-status`) expects this schedule; a miss is the alert,
 * and the accounting watch raises `accounting_status_check_missed` after 26 hours without a run.
 */
export const ACCOUNTING_BOOKS_STATUS_PATTERN = "15 2 * * *";
export const ACCOUNTING_BOOKS_STATUS_TIME_ZONE = "Europe/London";

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
  // Daily: read Stripe's fees and payouts into the Books queue, then reconcile yesterday. One job,
  // so the report always follows the read, even when one account's read failed. Its cron monitor is the missed-run alert; a
  // failure is reported like every worker job and retried by the queue's own attempts.
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
          const read = await accounting.stripeSync.run();
          await accounting.reconciliation.run();
          // The report goes out (and alerts) first; then the failed read fails the job too.
          if (read.failedAccounts > 0) {
            throw new Error(`accounting_stripe_accounts_failed:${read.failedAccounts}`);
          }
        },
      );
    },
    bullConnection,
  );
  reconcileWorker.on("failed", (job, err) =>
    reportWorkerJobFailure(ACCOUNTING_RECONCILE_QUEUE_NAME, job, err),
  );
  void reconcileQueue.add(
    "reconcile",
    {},
    {
      jobId: "accounting-reconcile-daily",
      repeat: { pattern: ACCOUNTING_RECONCILE_PATTERN, tz: ACCOUNTING_RECONCILE_TIME_ZONE },
      removeOnComplete: 30,
    },
  );
  log.info(
    `${ACCOUNTING_RECONCILE_QUEUE_NAME} repeat registered (${ACCOUNTING_RECONCILE_PATTERN} ${ACCOUNTING_RECONCILE_TIME_ZONE})`,
  );
  // Nightly: the Books status check. Its cron monitor is the missed-run alert, with the watch's
  // `accounting_status_check_missed`; no heartbeat, which would be stale most of the day.
  const statusQueue = new Queue(
    ACCOUNTING_BOOKS_STATUS_QUEUE_NAME,
    queueOpts(ACCOUNTING_BOOKS_STATUS_QUEUE_NAME),
  );
  const statusWorker = new Worker(
    ACCOUNTING_BOOKS_STATUS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        ACCOUNTING_CRON_MONITORS.booksStatus,
        sentryMonitorSlugs,
        async () => {
          await accounting.statusCheck.runNightly();
        },
      );
    },
    // One run at a time: a retry never overlaps a run still reading.
    { ...bullConnection, concurrency: 1 },
  );
  statusWorker.on("failed", (job, err) =>
    reportWorkerJobFailure(ACCOUNTING_BOOKS_STATUS_QUEUE_NAME, job, err),
  );
  void statusQueue.add(
    "books-status",
    {},
    {
      jobId: "accounting-books-status-nightly",
      repeat: { pattern: ACCOUNTING_BOOKS_STATUS_PATTERN, tz: ACCOUNTING_BOOKS_STATUS_TIME_ZONE },
      removeOnComplete: 30,
    },
  );
  log.info(
    `${ACCOUNTING_BOOKS_STATUS_QUEUE_NAME} repeat registered (${ACCOUNTING_BOOKS_STATUS_PATTERN} ${ACCOUNTING_BOOKS_STATUS_TIME_ZONE})`,
  );
  return {
    errorHandlers: [
      { worker, queue: ACCOUNTING_WATCH_QUEUE_NAME },
      { worker: reconcileWorker, queue: ACCOUNTING_RECONCILE_QUEUE_NAME },
      { worker: statusWorker, queue: ACCOUNTING_BOOKS_STATUS_QUEUE_NAME },
    ],
    close: () =>
      closeAll([worker, queue, reconcileWorker, reconcileQueue, statusWorker, statusQueue]),
  };
}
