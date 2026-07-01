import { WEBHOOK_EVENTS_QUEUE_NAME } from "@auction/queues";
import { Worker } from "bullmq";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type WebhookWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export function registerWebhookWorker(deps: WorkerBootstrapDeps): WebhookWorkersHandle {
  const { bullConnection, heartbeat, reportWorkerJobFailure } = deps;

  const webhookWorker = new Worker(
    WEBHOOK_EVENTS_QUEUE_NAME,
    async (job) => {
      deps.log.info({ jobId: job.id, name: job.name }, "processed webhook job");
      await heartbeat("webhook-events");
    },
    bullConnection,
  );
  webhookWorker.on("completed", () => void heartbeat("webhook-events"));
  webhookWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(WEBHOOK_EVENTS_QUEUE_NAME, job, err);
  });

  return {
    errorHandlers: [{ worker: webhookWorker, queue: WEBHOOK_EVENTS_QUEUE_NAME }],
    close: () => closeAll([webhookWorker]),
  };
}
