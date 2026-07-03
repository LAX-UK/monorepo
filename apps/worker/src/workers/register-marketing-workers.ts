import { MARKETING_EVENTS_QUEUE_NAME } from "@auction/queues";
import type { Queue, Worker } from "bullmq";
import type { MetaCapiBatchCollector } from "../marketing/meta-capi-batch-collector.js";
import {
  type MarketingEventsContext,
  closeMarketingEventsWorkers,
  createMarketingEventsContext,
  registerMarketingCapiBatchWorkers,
  registerMarketingEventsWorkers,
} from "./marketing/register-marketing-events-workers.js";
import {
  closeMarketingOutboxPollerWorkers,
  registerMarketingOutboxPollerWorkers,
} from "./marketing/register-marketing-outbox-poller-workers.js";
import {
  closeMarketingPurgeWorkers,
  registerMarketingPurgeWorkers,
} from "./marketing/register-marketing-purge-workers.js";
import {
  type MarketingSyncWorkersHandle,
  registerMarketingSyncWorkers,
} from "./marketing/register-marketing-sync-workers.js";
import type { DlqHandlerEntry, WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";

export type MarketingWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  dlqHandlers: DlqHandlerEntry[];
  marketingSyncQueue: Queue;
  marketingContactSync: MarketingSyncWorkersHandle["marketingContactSync"];
  marketingCapiBatchCollector: MetaCapiBatchCollector | undefined;
  drainMarketingPipeline: () => Promise<void>;
  close: () => Promise<void>;
};

export function registerMarketingWorkers(deps: WorkerBootstrapDeps): MarketingWorkersHandle {
  const sync = registerMarketingSyncWorkers(deps);

  const errorHandlers: WorkerErrorHandlerEntry[] = [...sync.errorHandlers];
  let dlqHandlers: DlqHandlerEntry[] = [];
  let marketingCapiBatchCollector: MetaCapiBatchCollector | undefined;
  let marketingEventsContext: MarketingEventsContext | undefined;
  let capiBatchWorker: Worker | undefined;
  let marketingEventsWorker: Worker | undefined;
  let outboxPollerWorker: Worker | undefined;
  let outboxPollerQueue: Queue | undefined;
  let purgeWorker: Worker | undefined;
  let purgeQueue: Queue | undefined;

  const ctx = createMarketingEventsContext(deps);
  if (ctx) {
    marketingEventsContext = ctx;
    marketingCapiBatchCollector = ctx.marketingCapiBatchCollector;

    const capiBatch = registerMarketingCapiBatchWorkers(deps, ctx);
    capiBatchWorker = capiBatch.worker;
    errorHandlers.push(...capiBatch.errorHandlers);

    const events = registerMarketingEventsWorkers(deps, ctx);
    marketingEventsWorker = events.worker;
    errorHandlers.push(...events.errorHandlers);
    dlqHandlers = [{ name: MARKETING_EVENTS_QUEUE_NAME, worker: events.worker }];

    const outboxPoller = registerMarketingOutboxPollerWorkers(deps, ctx);
    outboxPollerWorker = outboxPoller.worker;
    outboxPollerQueue = outboxPoller.queue;
    errorHandlers.push(...outboxPoller.errorHandlers);

    const purge = registerMarketingPurgeWorkers(deps);
    purgeWorker = purge.worker;
    purgeQueue = purge.queue;
    errorHandlers.push(...purge.errorHandlers);
  }

  async function drainMarketingPipeline(): Promise<void> {
    if (marketingCapiBatchCollector) {
      await marketingCapiBatchCollector.flush();
    }
    if (marketingEventsContext) {
      await closeMarketingEventsWorkers(marketingEventsContext, [
        marketingEventsWorker,
        capiBatchWorker,
      ]);
    }
    if (outboxPollerWorker && outboxPollerQueue) {
      await closeMarketingOutboxPollerWorkers(outboxPollerWorker, outboxPollerQueue);
    }
    if (purgeWorker && purgeQueue) {
      await closeMarketingPurgeWorkers(purgeWorker, purgeQueue);
    }
  }

  return {
    errorHandlers,
    dlqHandlers,
    marketingSyncQueue: sync.marketingSyncQueue,
    marketingContactSync: sync.marketingContactSync,
    marketingCapiBatchCollector,
    drainMarketingPipeline,
    close: () => sync.close(),
  };
}
