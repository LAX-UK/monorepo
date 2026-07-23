import { LOT_LIFECYCLE_QUEUE_NAME, createBullQueueOptions } from "@auction/queues";
import type { QueueName } from "@auction/queues";
import { type ConnectionOptions, type Job, Queue, Worker } from "bullmq";
import type pino from "pino";
import type { DlqHandlerEntry } from "../workers/types.js";
import { processLotLifecycleJob } from "./process-lot-lifecycle-job.js";
import type { WorkerLifecycleExecutor } from "./worker-lifecycle-executor.js";

export type LotJobData = { lotId: string };

export function registerWorkerLotLifecycleConsumer(opts: {
  connection: ConnectionOptions;
  executor: WorkerLifecycleExecutor;
  log: pino.Logger;
  onError: (err: Error) => void;
}): {
  worker: Worker<LotJobData>;
  queue: Queue<LotJobData>;
  dlqHandlers: DlqHandlerEntry[];
  close: () => Promise<void>;
} {
  const queueOpts = () =>
    createBullQueueOptions(LOT_LIFECYCLE_QUEUE_NAME, { connection: opts.connection });
  const queue = new Queue<LotJobData>(LOT_LIFECYCLE_QUEUE_NAME, queueOpts());
  const worker = new Worker<LotJobData>(
    LOT_LIFECYCLE_QUEUE_NAME,
    async (job: Job<LotJobData>) => {
      const lotId = job.data.lotId;
      await processLotLifecycleJob({
        jobName: job.name,
        lotId,
        executor: opts.executor,
      });
    },
    queueOpts(),
  );
  worker.on("error", (err) => opts.onError(err));
  worker.on("failed", (_job, err) => opts.onError(err));
  opts.log.info("lot-lifecycle worker registered (worker execution owner)");
  return {
    worker,
    queue,
    dlqHandlers: [{ name: LOT_LIFECYCLE_QUEUE_NAME as QueueName, worker }],
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
