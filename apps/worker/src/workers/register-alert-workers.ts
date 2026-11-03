import { DIGEST_TIME_ZONE } from "@auction/alerts";
import { ALERT_DIGEST_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import type { BidAlertRuntime } from "../container/create-bid-alert-runtime.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

/** 08:00 every day, read in London time so it follows the clock changes. */
export const ALERT_DIGEST_PATTERN = "0 8 * * *";

export type AlertWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerAlertWorkers(
  deps: WorkerBootstrapDeps,
  runtime: BidAlertRuntime,
): AlertWorkersHandle {
  const { log, bullConnection, queueOpts, sentryMonitorSlugs, reportWorkerJobFailure } = deps;
  const queue = new Queue(ALERT_DIGEST_QUEUE_NAME, queueOpts(ALERT_DIGEST_QUEUE_NAME));
  const worker = new Worker(
    ALERT_DIGEST_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("alert-digest", sentryMonitorSlugs, async () => {
        await runtime.digest.run(runtime.mode);
      });
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => reportWorkerJobFailure(ALERT_DIGEST_QUEUE_NAME, job, err));
  void queue.add(
    "digest",
    {},
    {
      jobId: "bid-alert-digest-daily-0800-london",
      repeat: { pattern: ALERT_DIGEST_PATTERN, tz: DIGEST_TIME_ZONE },
      removeOnComplete: 10,
    },
  );
  log.info(
    { pattern: ALERT_DIGEST_PATTERN, tz: DIGEST_TIME_ZONE, mode: runtime.mode },
    "alert digest repeat registered",
  );
  return {
    errorHandlers: [{ worker, queue: ALERT_DIGEST_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
