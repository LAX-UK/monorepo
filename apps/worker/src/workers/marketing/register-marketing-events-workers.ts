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
} from "@auction/queues";
import type { MarketingEvent, ResolvedMarketingEvent } from "@auction/types";
import { Queue, Worker } from "bullmq";
import type { WorkerEnv } from "../../env.js";
import {
  applyMarketingPublishOutcome,
  processMarketingEventJob,
} from "../../jobs/marketing-event-processor.js";
import { getMarketingEventsConfig } from "../../lib/marketing-events-enabled.js";
import { CachedClickIdStore } from "../../marketing/cached-click-id.store.js";
import { MetaCapiBatchCollector } from "../../marketing/meta-capi-batch-collector.js";
import { PostgresClickIdStore } from "../../marketing/postgres-click-id.store.js";
import { RedisClickIdStore } from "../../marketing/redis-click-id.store.js";
import type { WorkerBootstrapDeps, WorkerErrorHandlerEntry } from "../types.js";

export type MarketingEventsContext = {
  env: WorkerEnv;
  capiBatchQueue: Queue<ResolvedMarketingEvent>;
  marketingEventsQueue: Queue<MarketingEvent>;
  marketingCapiBatchCollector: MetaCapiBatchCollector;
  identityResolver: ProfileUserIdentityResolver;
  sgtmPublisher: SgtmMarketingEventPublisher;
};

export function createMarketingEventsContext(
  deps: WorkerBootstrapDeps,
): MarketingEventsContext | undefined {
  const { env, db, redis, log, queueOpts, profileMarketingReader, marketingEventOutboxWorker } =
    deps;
  const marketingConfig = getMarketingEventsConfig(env);
  if (!marketingConfig) return undefined;

  const hasher = new Sha256PiiHasher();
  const clickIdStore = new CachedClickIdStore(
    new PostgresClickIdStore(db),
    new RedisClickIdStore(redis),
  );
  const identityResolver = new ProfileUserIdentityResolver(
    profileMarketingReader,
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
  const metaCircuitBreaker = new InMemoryCircuitBreaker();
  const marketingCapiBatchCollector = new MetaCapiBatchCollector(
    metaPublisher,
    async (event, outcome) => {
      await applyMarketingPublishOutcome({ marketingEventOutboxWorker, env, log, event, outcome });
    },
    100,
    1000,
    1000,
    metaCircuitBreaker,
  );

  const marketingEventsQueue = new Queue<MarketingEvent>(
    MARKETING_EVENTS_QUEUE_NAME,
    queueOpts(MARKETING_EVENTS_QUEUE_NAME),
  );

  return {
    env,
    capiBatchQueue,
    marketingEventsQueue,
    marketingCapiBatchCollector,
    identityResolver,
    sgtmPublisher,
  };
}

export function registerMarketingCapiBatchWorkers(
  deps: WorkerBootstrapDeps,
  ctx: MarketingEventsContext,
): { errorHandlers: WorkerErrorHandlerEntry[]; worker: Worker<ResolvedMarketingEvent> } {
  const { bullConnection } = deps;
  const marketingCapiBatchWorker = new Worker<ResolvedMarketingEvent>(
    MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME,
    async (job) => {
      await ctx.marketingCapiBatchCollector.add(job.data);
    },
    { ...bullConnection, concurrency: 1 },
  );

  return {
    errorHandlers: [
      { worker: marketingCapiBatchWorker, queue: MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME },
    ],
    worker: marketingCapiBatchWorker,
  };
}

export function registerMarketingEventsWorkers(
  deps: WorkerBootstrapDeps,
  ctx: MarketingEventsContext,
): { errorHandlers: WorkerErrorHandlerEntry[]; worker: Worker<MarketingEvent> } {
  const { marketingEventOutboxWorker, log, bullConnection, heartbeat } = deps;

  const marketingProcessorDeps = {
    marketingEventOutboxWorker,
    env: ctx.env,
    log,
    identityResolver: ctx.identityResolver,
    sgtmPublisher: ctx.sgtmPublisher,
    enqueueCapiBatch: async (event: ResolvedMarketingEvent) => {
      await ctx.capiBatchQueue.add("batch", event, {
        jobId: event.eventId,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 10,
        backoff: { type: "exponential", delay: 5000 },
      });
    },
  };

  const concurrency = ctx.env.MARKETING_EVENT_WORKER_CONCURRENCY ?? 5;
  const marketingEventsWorker = new Worker<MarketingEvent>(
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

  return {
    errorHandlers: [{ worker: marketingEventsWorker, queue: MARKETING_EVENTS_QUEUE_NAME }],
    worker: marketingEventsWorker,
  };
}

export async function closeMarketingEventsWorkers(
  ctx: MarketingEventsContext,
  workers: Array<Worker | undefined>,
): Promise<void> {
  await Promise.allSettled([
    ...workers.filter((w): w is Worker => w != null).map((w) => w.close()),
    ctx.marketingEventsQueue.close(),
    ctx.capiBatchQueue.close(),
  ]);
}
