import { ACCOUNTING_WATCH_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { ACCOUNTING_CRON_MONITORS } from "../finance/accounting/accounting-alerts.js";
import type { AccountingRuntime } from "../finance/accounting/accounting-runtime.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** How often the Books queue is checked; also the interval its cron monitor expects. */
export const ACCOUNTING_WATCH_EVERY_MS = 15 * 60_000;

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
  return {
    errorHandlers: [{ worker, queue: ACCOUNTING_WATCH_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
