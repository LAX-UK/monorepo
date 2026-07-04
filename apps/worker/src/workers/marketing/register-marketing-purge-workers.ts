import { PURGE_MARKETING_CLICK_IDS_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { purgeStaleMarketingClickIds } from "../../jobs/purge-stale-marketing-click-ids.js";
import { purgeStaleMarketingOutbox } from "../../jobs/purge-stale-marketing-outbox.js";
import { withSentryCronMonitor } from "../../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "../types.js";
import { closeAll } from "../worker-utils.js";

export function registerMarketingPurgeWorkers(deps: WorkerBootstrapDeps): {
  errorHandlers: WorkerErrorHandlerEntry[];
  worker: Worker;
  queue: Queue;
} {
  const { log, bullConnection, sentryMonitorSlugs, reportWorkerJobFailure } = deps;
  const { marketingClickIdPurgeRepo, marketingEventOutboxWorker } = deps;

  const purgeMarketingClickIdsQueue = new Queue(
    PURGE_MARKETING_CLICK_IDS_QUEUE_NAME,
    deps.queueOpts(PURGE_MARKETING_CLICK_IDS_QUEUE_NAME),
  );
  const purgeMarketingClickIdsWorker = new Worker(
    PURGE_MARKETING_CLICK_IDS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("purge-marketing-click-ids", sentryMonitorSlugs, async () => {
        await purgeStaleMarketingClickIds({ marketingClickIdPurgeRepo, log });
        await purgeStaleMarketingOutbox({ marketingEventOutboxWorker, log });
      });
    },
    bullConnection,
  );
  void purgeMarketingClickIdsQueue.add(
    "purge",
    {},
    {
      jobId: "purge-marketing-click-ids-daily",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 5,
    },
  );
  purgeMarketingClickIdsWorker.on("failed", (job, err) => {
    reportWorkerJobFailure("purge-marketing-click-ids", job, err);
  });

  return {
    errorHandlers: [
      { worker: purgeMarketingClickIdsWorker, queue: PURGE_MARKETING_CLICK_IDS_QUEUE_NAME },
    ],
    worker: purgeMarketingClickIdsWorker,
    queue: purgeMarketingClickIdsQueue,
  };
}

export function closeMarketingPurgeWorkers(worker: Worker, queue: Queue): Promise<void> {
  return closeAll([worker, queue]);
}
