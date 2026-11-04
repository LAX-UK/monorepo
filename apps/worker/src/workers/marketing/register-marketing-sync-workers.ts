import { MARKETING_SYNC_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import {
  type ZohoCampaignsSyncJobData,
  zohoCampaignsSyncJob,
} from "../../jobs/zoho-campaigns-sync.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "../types.js";
import { closeAll } from "../worker-utils.js";

type MarketingSyncJobData = ZohoCampaignsSyncJobData;

export type MarketingSyncWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  marketingSyncQueue: Queue<MarketingSyncJobData>;
  close: () => Promise<void>;
};

export function registerMarketingSyncWorkers(
  deps: WorkerBootstrapDeps,
): MarketingSyncWorkersHandle {
  const {
    env,
    log,
    bullConnection,
    queueOpts,
    heartbeat,
    reportWorkerJobFailure,
    newsletterSignupSyncRepo,
  } = deps;

  const marketingSyncQueue = new Queue<MarketingSyncJobData>(
    MARKETING_SYNC_QUEUE_NAME,
    queueOpts(MARKETING_SYNC_QUEUE_NAME),
  );
  const marketingSyncWorker = new Worker<MarketingSyncJobData>(
    MARKETING_SYNC_QUEUE_NAME,
    async (job) => {
      if (job.name === "zoho-campaigns-sync") {
        await zohoCampaignsSyncJob({
          newsletterSignupSyncRepo,
          env,
          log,
          data: job.data as ZohoCampaignsSyncJobData,
        });
      } else {
        log.warn({ jobId: job.id, name: job.name }, "unknown marketing-sync job");
      }
      await heartbeat("marketing-sync");
    },
    { ...bullConnection, concurrency: 3, limiter: { max: 10, duration: 1000 } },
  );
  marketingSyncWorker.on("completed", () => void heartbeat("marketing-sync"));
  marketingSyncWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(MARKETING_SYNC_QUEUE_NAME, job, err);
  });

  return {
    errorHandlers: [{ worker: marketingSyncWorker, queue: MARKETING_SYNC_QUEUE_NAME }],
    marketingSyncQueue,
    close: () => closeAll([marketingSyncWorker, marketingSyncQueue]),
  };
}
