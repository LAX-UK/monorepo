import { ATG_SYNC_JOB_NAMES, ATG_SYNC_QUEUE_NAME } from "@auction/queues";
import { Queue, UnrecoverableError, Worker } from "bullmq";
import type { AtgSyncRuntime } from "../container/create-atg-sync-runtime.js";
import { isPermanentAtgJobError, processAtgSyncJob } from "../integrations/atg/atg-sync-job.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type AtgSyncWorkerHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

/**
 * ATG White Label sync. Registers nothing without a runtime (ATG_SYNC_ENABLED off), so a
 * disabled deployment has no queue, no consumer and no readiness heartbeat for it.
 *
 * The consumer runs at concurrency 1: job de-duplication relies on stable job ids and
 * the sync service assumes one push per sale at a time.
 */
export function registerAtgSyncWorker(
  deps: WorkerBootstrapDeps,
  runtime: AtgSyncRuntime | null,
): AtgSyncWorkerHandle {
  const { log, bullConnection, queueOpts, heartbeat, reportWorkerJobFailure } = deps;
  if (!runtime) return { errorHandlers: [], close: async () => {} };
  const { service } = runtime;

  const queue = new Queue(ATG_SYNC_QUEUE_NAME, queueOpts(ATG_SYNC_QUEUE_NAME));
  const worker = new Worker(
    ATG_SYNC_QUEUE_NAME,
    async (job) => {
      try {
        const result = await processAtgSyncJob(job, service);
        log.info({ jobId: job.id, name: job.name, result }, "atg-sync job completed");
        await heartbeat("atg-sync");
        return result;
      } catch (err) {
        if (isPermanentAtgJobError(err)) {
          throw new UnrecoverableError(err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
    { ...bullConnection, concurrency: 1 },
  );
  worker.on("failed", (job, err) => {
    reportWorkerJobFailure(ATG_SYNC_QUEUE_NAME, job, err);
  });
  void queue.add(
    ATG_SYNC_JOB_NAMES.tick,
    {},
    {
      jobId: "atg-sync-tick",
      repeat: { every: runtime.pollIntervalMs },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );
  void heartbeat("atg-sync");
  log.info({ pollIntervalMs: runtime.pollIntervalMs }, "atg-sync enabled");

  return {
    errorHandlers: [{ worker, queue: ATG_SYNC_QUEUE_NAME }],
    close: () => closeAll([worker, queue]),
  };
}
