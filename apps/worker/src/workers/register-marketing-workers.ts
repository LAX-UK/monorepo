import {
  InMemoryCircuitBreaker,
  MetaCapiMarketingEventPublisher,
  ProfileUserIdentityResolver,
  SgtmMarketingEventPublisher,
  Sha256PiiHasher,
} from "@auction/marketing-events";
import {
  MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME,
  MARKETING_EVENTS_QUEUE_NAME,
  MARKETING_OUTBOX_POLLER_QUEUE_NAME,
  MARKETING_SYNC_QUEUE_NAME,
  PURGE_MARKETING_CLICK_IDS_QUEUE_NAME,
  QUEUE_REGISTRY,
} from "@auction/queues";
import type { MarketingEvent, ResolvedMarketingEvent } from "@auction/types";
import { Queue, Worker } from "bullmq";
import {
  type MarketingContactSyncJobData,
  marketingContactSyncJob,
} from "../jobs/marketing-contact-sync.js";
import {
  applyMarketingPublishOutcome,
  processMarketingEventJob,
  runMarketingEventOutboxPoller,
} from "../jobs/marketing-event-processor.js";
import { purgeStaleMarketingClickIds } from "../jobs/purge-stale-marketing-click-ids.js";
import { purgeStaleMarketingOutbox } from "../jobs/purge-stale-marketing-outbox.js";
import {
  type ZohoCampaignsSyncJobData,
  zohoCampaignsSyncJob,
} from "../jobs/zoho-campaigns-sync.js";
import { createMarketingContactSync } from "../lib/marketing-contact-sync/index.js";
import { getMarketingEventsConfig } from "../lib/marketing-events-enabled.js";
import { withSentryCronMonitor } from "../lib/sentry-cron.js";
import { CachedClickIdStore } from "../marketing/cached-click-id.store.js";
import { DrizzleProfileMarketingReader } from "../marketing/drizzle-profile.reader.js";
import { MetaCapiBatchCollector } from "../marketing/meta-capi-batch-collector.js";
import { PostgresClickIdStore } from "../marketing/postgres-click-id.store.js";
import { RedisClickIdStore } from "../marketing/redis-click-id.store.js";
import type { DlqHandlerEntry, WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "./types.js";
import { closeAll } from "./worker-utils.js";

type MarketingSyncJobData = ZohoCampaignsSyncJobData | MarketingContactSyncJobData;

export type MarketingWorkersHandle = {
  errorHandlers: WorkerErrorHandlerEntry[];
  dlqHandlers: DlqHandlerEntry[];
  marketingSyncQueue: Queue;
  marketingContactSync: ReturnType<typeof createMarketingContactSync>;
  marketingCapiBatchCollector: MetaCapiBatchCollector | undefined;
  drainMarketingPipeline: () => Promise<void>;
  close: () => Promise<void>;
};

export function registerMarketingWorkers(deps: WorkerBootstrapDeps): MarketingWorkersHandle {
  const {
    env,
    db,
    redis,
    log,
    bullConnection,
    queueOpts,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
  } = deps;

  const marketingContactSync = createMarketingContactSync(env);
  const marketingSyncQueue = new Queue<MarketingSyncJobData>(
    MARKETING_SYNC_QUEUE_NAME,
    queueOpts(MARKETING_SYNC_QUEUE_NAME),
  );
  const marketingSyncWorker = new Worker<MarketingSyncJobData>(
    MARKETING_SYNC_QUEUE_NAME,
    async (job) => {
      if (job.name === "zoho-campaigns-sync") {
        await zohoCampaignsSyncJob({ db, env, log, data: job.data as ZohoCampaignsSyncJobData });
      } else if (job.name === "marketing-contact-sync") {
        if (!marketingContactSync) {
          log.warn(
            { jobId: job.id },
            "marketing-contact-sync job received but no provider configured",
          );
        } else {
          await marketingContactSyncJob({
            db,
            sync: marketingContactSync,
            log,
            data: job.data as MarketingContactSyncJobData,
          });
        }
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

  let marketingEventsWorker: Worker<MarketingEvent> | undefined;
  let marketingEventsQueue: Queue<MarketingEvent> | undefined;
  let marketingCapiBatchWorker: Worker<ResolvedMarketingEvent> | undefined;
  let marketingCapiBatchQueue: Queue<ResolvedMarketingEvent> | undefined;
  let marketingOutboxPollerWorker: Worker | undefined;
  let marketingOutboxPollerQueue: Queue | undefined;
  let marketingCapiBatchCollector: MetaCapiBatchCollector | undefined;
  let purgeMarketingClickIdsWorker: Worker | undefined;
  let purgeMarketingClickIdsQueue: Queue | undefined;

  const marketingConfig = getMarketingEventsConfig(env);
  if (marketingConfig) {
    const hasher = new Sha256PiiHasher();
    const clickIdStore = new CachedClickIdStore(
      new PostgresClickIdStore(db),
      new RedisClickIdStore(redis),
    );
    const identityResolver = new ProfileUserIdentityResolver(
      new DrizzleProfileMarketingReader(db),
      clickIdStore,
      hasher,
    );
    const sgtmPublisher = new SgtmMarketingEventPublisher(
      marketingConfig.sgtmEndpointUrl,
      marketingConfig.ga4MeasurementId,
    );
    const metaPublisher = new MetaCapiMarketingEventPublisher(
      marketingConfig.metaPixelId,
      marketingConfig.metaCapiAccessToken,
      marketingConfig.metaCapiTestEventCode,
      marketingConfig.metaGraphApiVersion,
    );

    const capiBatchQueue = new Queue<ResolvedMarketingEvent>(
      MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME,
      queueOpts(MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME),
    );
    marketingCapiBatchQueue = capiBatchQueue;
    const metaCircuitBreaker = new InMemoryCircuitBreaker();
    marketingCapiBatchCollector = new MetaCapiBatchCollector(
      metaPublisher,
      async (event, outcome) => {
        await applyMarketingPublishOutcome({ db, env, log, event, outcome });
      },
      100,
      1000,
      1000,
      metaCircuitBreaker,
    );
    const batchCollector = marketingCapiBatchCollector;

    marketingCapiBatchWorker = new Worker<ResolvedMarketingEvent>(
      MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME,
      async (job) => {
        await batchCollector.add(job.data);
      },
      { ...bullConnection, concurrency: 1 },
    );

    const marketingProcessorDeps = {
      db,
      env,
      log,
      identityResolver,
      sgtmPublisher,
      enqueueCapiBatch: async (event: ResolvedMarketingEvent) => {
        await capiBatchQueue.add("batch", event, {
          jobId: event.eventId,
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 10,
          backoff: { type: "exponential", delay: 5000 },
        });
      },
    };

    marketingEventsQueue = new Queue<MarketingEvent>(
      MARKETING_EVENTS_QUEUE_NAME,
      queueOpts(MARKETING_EVENTS_QUEUE_NAME),
    );
    const concurrency = env.MARKETING_EVENT_WORKER_CONCURRENCY ?? 5;
    marketingEventsWorker = new Worker<MarketingEvent>(
      MARKETING_EVENTS_QUEUE_NAME,
      async (job) => {
        await processMarketingEventJob(marketingProcessorDeps, job.data);
        await heartbeat("marketing-events");
      },
      {
        ...bullConnection,
        concurrency,
        limiter: { max: 200, duration: 1000 },
      },
    );
    marketingEventsWorker.on("completed", () => void heartbeat("marketing-events"));

    marketingOutboxPollerQueue = new Queue(
      MARKETING_OUTBOX_POLLER_QUEUE_NAME,
      queueOpts(MARKETING_OUTBOX_POLLER_QUEUE_NAME),
    );
    marketingOutboxPollerWorker = new Worker(
      MARKETING_OUTBOX_POLLER_QUEUE_NAME,
      async () => {
        await withSentryCronMonitor("marketing-outbox-poller", sentryMonitorSlugs, async () => {
          const eventsQueue = marketingEventsQueue;
          if (!eventsQueue) return;
          await runMarketingEventOutboxPoller({
            db,
            log,
            enqueue: async (event) => {
              await eventsQueue.add("publish", event, {
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

    purgeMarketingClickIdsQueue = new Queue(
      PURGE_MARKETING_CLICK_IDS_QUEUE_NAME,
      queueOpts(PURGE_MARKETING_CLICK_IDS_QUEUE_NAME),
    );
    purgeMarketingClickIdsWorker = new Worker(
      PURGE_MARKETING_CLICK_IDS_QUEUE_NAME,
      async () => {
        await withSentryCronMonitor("purge-marketing-click-ids", sentryMonitorSlugs, async () => {
          await purgeStaleMarketingClickIds({ db, log });
          await purgeStaleMarketingOutbox({ db, log });
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
  }

  const errorHandlers: WorkerErrorHandlerEntry[] = [
    { worker: marketingSyncWorker, queue: MARKETING_SYNC_QUEUE_NAME },
    ...(marketingCapiBatchWorker
      ? [{ worker: marketingCapiBatchWorker, queue: MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME }]
      : []),
    ...(marketingEventsWorker
      ? [{ worker: marketingEventsWorker, queue: MARKETING_EVENTS_QUEUE_NAME }]
      : []),
    ...(marketingOutboxPollerWorker
      ? [{ worker: marketingOutboxPollerWorker, queue: MARKETING_OUTBOX_POLLER_QUEUE_NAME }]
      : []),
    ...(purgeMarketingClickIdsWorker
      ? [{ worker: purgeMarketingClickIdsWorker, queue: PURGE_MARKETING_CLICK_IDS_QUEUE_NAME }]
      : []),
  ];

  const dlqHandlers: DlqHandlerEntry[] = marketingEventsWorker
    ? [{ name: MARKETING_EVENTS_QUEUE_NAME, worker: marketingEventsWorker }]
    : [];

  async function drainMarketingPipeline(): Promise<void> {
    if (marketingCapiBatchCollector) {
      await marketingCapiBatchCollector.flush();
    }
    await Promise.allSettled([
      ...(marketingEventsWorker ? [marketingEventsWorker.close()] : []),
      ...(marketingCapiBatchWorker ? [marketingCapiBatchWorker.close()] : []),
      ...(marketingOutboxPollerWorker ? [marketingOutboxPollerWorker.close()] : []),
      ...(marketingEventsQueue ? [marketingEventsQueue.close()] : []),
      ...(marketingCapiBatchQueue ? [marketingCapiBatchQueue.close()] : []),
      ...(marketingOutboxPollerQueue ? [marketingOutboxPollerQueue.close()] : []),
      ...(purgeMarketingClickIdsWorker ? [purgeMarketingClickIdsWorker.close()] : []),
      ...(purgeMarketingClickIdsQueue ? [purgeMarketingClickIdsQueue.close()] : []),
    ]);
  }

  return {
    errorHandlers,
    dlqHandlers,
    marketingSyncQueue,
    marketingContactSync,
    marketingCapiBatchCollector,
    drainMarketingPipeline,
    close: () => closeAll([marketingSyncWorker, marketingSyncQueue]),
  };
}
