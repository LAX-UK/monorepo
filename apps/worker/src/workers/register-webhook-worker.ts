import {
  WEBHOOK_EVENTS_QUEUE_NAME,
  WEBHOOK_EVENT_DRAIN_JOB_NAME,
  type WebhookEventsJobData,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import {
  type ProcessInboundWebhookDeps,
  drainUnprocessedWebhookEvents,
  processInboundWebhookEvent,
} from "../jobs/process-inbound-webhook-event.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type WebhookWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export type RegisterWebhookWorkerInput = WorkerBootstrapDeps & {
  webhookProcessorDeps: ProcessInboundWebhookDeps;
};

export function registerWebhookWorker(input: RegisterWebhookWorkerInput): WebhookWorkersHandle {
  const {
    bullConnection,
    heartbeat,
    reportWorkerJobFailure,
    webhookProcessorDeps,
    queueOpts,
    log,
  } = input;

  const webhookQueue = new Queue<WebhookEventsJobData>(
    WEBHOOK_EVENTS_QUEUE_NAME,
    queueOpts(WEBHOOK_EVENTS_QUEUE_NAME),
  );

  const webhookWorker = new Worker<WebhookEventsJobData>(
    WEBHOOK_EVENTS_QUEUE_NAME,
    async (job) => {
      if (job.name === WEBHOOK_EVENT_DRAIN_JOB_NAME) {
        const count = await drainUnprocessedWebhookEvents(webhookProcessorDeps);
        log.info({ count }, "webhook_event drain completed");
        await heartbeat("webhook-events");
        return;
      }

      const eventKey = job.data?.eventKey;
      if (!eventKey || typeof eventKey !== "string") {
        throw new Error("webhook job missing eventKey");
      }

      await processInboundWebhookEvent(webhookProcessorDeps, eventKey);
      await heartbeat("webhook-events");
    },
    bullConnection,
  );
  webhookWorker.on("completed", () => void heartbeat("webhook-events"));
  webhookWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(WEBHOOK_EVENTS_QUEUE_NAME, job, err);
  });

  void webhookQueue.add(
    WEBHOOK_EVENT_DRAIN_JOB_NAME,
    { eventKey: "drain" },
    {
      jobId: WEBHOOK_EVENT_DRAIN_JOB_NAME,
      repeat: { every: 60_000 },
      removeOnComplete: 100,
    },
  );

  return {
    errorHandlers: [{ worker: webhookWorker, queue: WEBHOOK_EVENTS_QUEUE_NAME }],
    close: () => closeAll([webhookWorker, webhookQueue]),
  };
}
