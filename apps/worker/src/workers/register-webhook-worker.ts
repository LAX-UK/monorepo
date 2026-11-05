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
import {
  ZOHO_ARTWORK_NIGHTLY_JOB_NAME,
  ZOHO_ARTWORK_NIGHTLY_PATTERN,
  ZOHO_ARTWORK_NIGHTLY_TIME_ZONE,
} from "../jobs/zoho-artwork-sync.job.js";
import {
  ZOHO_LISTING_NIGHTLY_JOB_NAME,
  ZOHO_LISTING_NIGHTLY_PATTERN,
  ZOHO_LISTING_NIGHTLY_TIME_ZONE,
} from "../jobs/zoho-listing-reconcile.job.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

export type WebhookWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  close: () => Promise<void>;
};

export type RegisterWebhookWorkerInput = WorkerBootstrapDeps & {
  webhookProcessorDeps: ProcessInboundWebhookDeps;
  /** Set when the Zoho artwork sync is on; schedules its nightly check on this queue. */
  runZohoArtworkNightlyCheck?: () => Promise<void>;
  /** Set when the LAX listing on Zoho is on; schedules its nightly pass on this queue. */
  runZohoListingNightlyCheck?: () => Promise<void>;
};

export function registerWebhookWorker(input: RegisterWebhookWorkerInput): WebhookWorkersHandle {
  const {
    bullConnection,
    heartbeat,
    reportWorkerJobFailure,
    webhookProcessorDeps,
    runZohoArtworkNightlyCheck,
    runZohoListingNightlyCheck,
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

      if (job.name === ZOHO_ARTWORK_NIGHTLY_JOB_NAME) {
        if (!runZohoArtworkNightlyCheck)
          throw new Error("zoho artwork nightly check not configured");
        await runZohoArtworkNightlyCheck();
        await heartbeat("webhook-events");
        return;
      }

      if (job.name === ZOHO_LISTING_NIGHTLY_JOB_NAME) {
        if (!runZohoListingNightlyCheck)
          throw new Error("zoho listing nightly check not configured");
        await runZohoListingNightlyCheck();
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

  if (runZohoArtworkNightlyCheck) {
    void webhookQueue.add(
      ZOHO_ARTWORK_NIGHTLY_JOB_NAME,
      { eventKey: ZOHO_ARTWORK_NIGHTLY_JOB_NAME },
      {
        jobId: ZOHO_ARTWORK_NIGHTLY_JOB_NAME,
        repeat: {
          pattern: ZOHO_ARTWORK_NIGHTLY_PATTERN,
          tz: ZOHO_ARTWORK_NIGHTLY_TIME_ZONE,
        },
        removeOnComplete: 30,
      },
    );
  }

  if (runZohoListingNightlyCheck) {
    void webhookQueue.add(
      ZOHO_LISTING_NIGHTLY_JOB_NAME,
      { eventKey: ZOHO_LISTING_NIGHTLY_JOB_NAME },
      {
        jobId: ZOHO_LISTING_NIGHTLY_JOB_NAME,
        repeat: { pattern: ZOHO_LISTING_NIGHTLY_PATTERN, tz: ZOHO_LISTING_NIGHTLY_TIME_ZONE },
        removeOnComplete: 30,
      },
    );
  }

  return {
    errorHandlers: [{ worker: webhookWorker, queue: WEBHOOK_EVENTS_QUEUE_NAME }],
    close: () => closeAll([webhookWorker, webhookQueue]),
  };
}
