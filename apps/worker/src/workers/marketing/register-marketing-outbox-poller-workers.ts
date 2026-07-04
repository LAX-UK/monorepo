import {
  MARKETING_EVENTS_QUEUE_NAME,
  MARKETING_OUTBOX_POLLER_QUEUE_NAME,
  QUEUE_REGISTRY,
} from "@auction/queues";
import { Queue, Worker } from "bullmq";
import { runMarketingEventOutboxPoller } from "../../jobs/marketing-event-processor.js";
import { withSentryCronMonitor } from "../../lib/sentry-cron.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "../types.js";
import { closeAll } from "../worker-utils.js";
import type { MarketingEventsContext } from "./register-marketing-events-workers.js";

export function registerMarketingOutboxPollerWorkers(
  deps: WorkerBootstrapDeps,
  ctx: MarketingEventsContext,
): {
  errorHandlers: WorkerErrorHandlerEntry[];
  worker: Worker;
  queue: Queue;
} {
  const {
    marketingEventOutboxWorker,
    log,
    bullConnection,
    sentryMonitorSlugs,
    reportWorkerJobFailure,
  } = deps;

  const marketingOutboxPollerQueue = new Queue(
    MARKETING_OUTBOX_POLLER_QUEUE_NAME,
    deps.queueOpts(MARKETING_OUTBOX_POLLER_QUEUE_NAME),
  );
  const marketingOutboxPollerWorker = new Worker(
    MARKETING_OUTBOX_POLLER_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("marketing-outbox-poller", sentryMonitorSlugs, async () => {
        await runMarketingEventOutboxPoller({
          marketingEventOutboxWorker,
          log,
          enqueue: async (event) => {
            await ctx.marketingEventsQueue.add("publish", event, {
              jobId: event.eventId,
              attempts: QUEUE_REGISTRY[MARKETING_EVENTS_QUEUE_NAME].defaultJobOptions.attempts,
              backoff: QUEUE_REGISTRY[MARKETING_EVENTS_QUEUE_NAME].defaultJobOptions.backoff,
            });
          },
        });
      });
    },
    bullConnection,
  );
  void marketingOutboxPollerQueue.add(
    "poll",
    {},
    { jobId: "marketing-outbox-poller-30s", repeat: { every: 30_000 }, removeOnComplete: 10 },
  );
  marketingOutboxPollerWorker.on("failed", (job, err) => {
    reportWorkerJobFailure("marketing-outbox-poller", job, err);
  });

  return {
    errorHandlers: [
      { worker: marketingOutboxPollerWorker, queue: MARKETING_OUTBOX_POLLER_QUEUE_NAME },
    ],
    worker: marketingOutboxPollerWorker,
    queue: marketingOutboxPollerQueue,
  };
}

export function closeMarketingOutboxPollerWorkers(worker: Worker, queue: Queue): Promise<void> {
  return closeAll([worker, queue]);
}
