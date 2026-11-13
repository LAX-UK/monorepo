import { FAILED_JOBS_WATCH_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import {
  FAILED_JOBS_CRON_MONITORS,
  type FailedJobsWatch,
} from "../ops/failed-jobs/failed-jobs-watch.service.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** 08:00 every day, read in London time so it follows the clock changes. */
export const FAILED_JOBS_WATCH_PATTERN = "0 8 * * *";
export const FAILED_JOBS_WATCH_TIME_ZONE = "Europe/London";

export type FailedJobsWatchWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

/**
 * The Failed jobs watch: daily at 08:00 London under its Sentry cron monitor, like the alert
 * digest. A daily job has no heartbeat (readiness would fail it 23 hours a day); a missed
 * check-in is the alert that it stopped.
 */
export function registerFailedJobsWatchWorker(
  deps: WorkerBootstrapDeps,
  watch: Pick<FailedJobsWatch, "check">,
): FailedJobsWatchWorkersHandle {
  const { log, bullConnection, queueOpts, sentryMonitorSlugs, reportWorkerJobFailure } = deps;
  const queue = new Queue(FAILED_JOBS_WATCH_QUEUE_NAME, queueOpts(FAILED_JOBS_WATCH_QUEUE_NAME));
  const worker = new Worker(
    FAILED_JOBS_WATCH_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(FAILED_JOBS_CRON_MONITORS.watch, sentryMonitorSlugs, async () => {
        await watch.check();
      });
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => reportWorkerJobFailure(FAILED_JOBS_WATCH_QUEUE_NAME, job, err));
  void queue.add(
    "watch",
    {},
    {
      jobId: "failed-jobs-watch-daily-0800-london",
      repeat: { pattern: FAILED_JOBS_WATCH_PATTERN, tz: FAILED_JOBS_WATCH_TIME_ZONE },
      removeOnComplete: 10,
    },
  );
  log.info(
    { pattern: FAILED_JOBS_WATCH_PATTERN, tz: FAILED_JOBS_WATCH_TIME_ZONE },
    "failed jobs watch repeat registered",
  );
  return {
    errorHandlers: [{ worker, queue: FAILED_JOBS_WATCH_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
