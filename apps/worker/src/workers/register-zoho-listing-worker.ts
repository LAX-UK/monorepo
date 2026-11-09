import { ZOHO_LISTING_SALE_START_QUEUE_NAME } from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { SALE_START_PASS_INTERVAL_MS } from "../integrations/zoho/artwork/listing/zoho-listing-sale-start.js";
import {
  ZOHO_LISTING_SALE_START_JOB_NAME,
  ZOHO_LISTING_SALE_START_MONITOR_KEY,
} from "../jobs/zoho-listing-reconcile.job.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type ZohoListingWorkerHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

/**
 * The sale-start pass of the LAX listing on Zoho. It has its own queue, like the other cron jobs,
 * so a slow pass never delays the single-concurrency webhook queue. Registers nothing when the
 * listing is off. A failed run is not retried: the next one starts from the last fully covered
 * instant and makes up for it.
 */
export function registerZohoListingWorker(
  deps: WorkerBootstrapDeps,
  runSaleStartCheck: (() => Promise<void>) | null,
): ZohoListingWorkerHandle {
  const { log, bullConnection, sentryMonitorSlugs, heartbeat, reportWorkerJobFailure } = deps;
  if (!runSaleStartCheck) return { errorHandlers: [], close: async () => {} };

  const queue = new Queue(ZOHO_LISTING_SALE_START_QUEUE_NAME, bullConnection);
  const worker = new Worker(
    ZOHO_LISTING_SALE_START_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        ZOHO_LISTING_SALE_START_MONITOR_KEY,
        sentryMonitorSlugs,
        runSaleStartCheck,
      );
      await heartbeat(ZOHO_LISTING_SALE_START_QUEUE_NAME);
    },
    bullConnection,
  );
  worker.on("failed", (job, err) => {
    reportWorkerJobFailure(ZOHO_LISTING_SALE_START_QUEUE_NAME, job, err);
  });
  void queue.add(
    ZOHO_LISTING_SALE_START_JOB_NAME,
    {},
    {
      jobId: ZOHO_LISTING_SALE_START_JOB_NAME,
      repeat: { every: SALE_START_PASS_INTERVAL_MS },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );
  log.info("zoho-listing-sale-start repeat registered (every 15 minutes)");
  return {
    errorHandlers: [{ worker, queue: ZOHO_LISTING_SALE_START_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
