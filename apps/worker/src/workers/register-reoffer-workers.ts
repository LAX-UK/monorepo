import { REOFFER_SWEEP_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { type ReofferSweepResult, runReofferSweepJob } from "../jobs/reoffer-sweep.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type ReofferWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export type ReofferWorkersOptions = Pick<
  Parameters<typeof runReofferSweepJob>[0],
  "reader" | "clock" | "marker" | "ensureInvoice"
>;

/** Every 15 minutes: lapses and ends what has run out, and sends each reminder once. */
const SWEEP_EVERY_MS = 15 * 60 * 1000;

/** The re-offer clock after a buyer default (see `runReofferSweepJob`). */
export function registerReofferWorkers(
  deps: WorkerBootstrapDeps,
  options: ReofferWorkersOptions,
): ReofferWorkersHandle {
  const { log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;

  const queue = new Queue(REOFFER_SWEEP_QUEUE_NAME, bullConnection);
  const worker = new Worker(
    REOFFER_SWEEP_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(REOFFER_SWEEP_QUEUE_NAME, sentryMonitorSlugs, async () => {
        const result: ReofferSweepResult = await runReofferSweepJob({ ...options, log });
        // Report to Sentry and the queue by failing the job, after every offer has been tried.
        if (result.failed > 0) throw new Error(`reoffer sweep: ${result.failed} step(s) failed`);
        await heartbeat(REOFFER_SWEEP_QUEUE_NAME);
      });
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => {
    reportWorkerJobFailure(REOFFER_SWEEP_QUEUE_NAME, job, err);
  });
  void queue.add(
    REOFFER_SWEEP_QUEUE_NAME,
    {},
    {
      jobId: "quarter-hourly-reoffer-sweep",
      repeat: { every: SWEEP_EVERY_MS },
      removeOnComplete: 50,
    },
  );
  log.info("reoffer-sweep repeat registered (every 15 minutes)");

  return {
    errorHandlers: [{ worker, queue: REOFFER_SWEEP_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
