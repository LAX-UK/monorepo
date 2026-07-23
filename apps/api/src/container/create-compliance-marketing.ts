import type { Database } from "@auction/db";
import {
  CompositeMarketingEventPublisher,
  type IAttributionStore,
  type IClickIdStore,
  type IMarketingEventPublisher,
  InMemoryCircuitBreaker,
  MetaCapiMarketingEventPublisher,
  SgtmMarketingEventPublisher,
} from "@auction/marketing-events";
import type { Env } from "../env.js";
import { BullmqMarketingEventQueue } from "../infrastructure/bullmq-marketing-event.queue.js";
import { CachedAttributionStore } from "../infrastructure/cached-attribution.store.js";
import { CachedClickIdStore } from "../infrastructure/cached-click-id.store.js";
import { DrizzleMarketingEventOutboxRepository } from "../infrastructure/drizzle-marketing-event-outbox.repository.js";
import { EventMarketingConsentGate } from "../infrastructure/header-marketing-consent.gate.js";
import { NoopMarketingEventOutboxRepository } from "../infrastructure/noop-marketing-event-outbox.repository.js";
import { NoopMarketingEventPublisher } from "../infrastructure/noop-marketing-event.publisher.js";
import { NoopMarketingEventQueue } from "../infrastructure/noop-marketing-event.queue.js";
import { PostgresAttributionStore } from "../infrastructure/postgres-attribution.store.js";
import { PostgresClickIdStore } from "../infrastructure/postgres-click-id.store.js";
import { RedisAttributionStore } from "../infrastructure/redis-attribution.store.js";
import { RedisClickIdStore } from "../infrastructure/redis-click-id.store.js";
import {
  getMarketingEventsConfig,
  isMarketingAttributionEnabled,
} from "../lib/marketing-events-enabled.js";
import type { IMarketingEventService } from "../services/interfaces/marketing-event-service.js";
import { MarketingEventService } from "../services/marketing-event.service.js";
import type { ContainerInfra } from "./create-infra.js";

export type ComplianceMarketingSlice = {
  marketingEventService: IMarketingEventService;
  marketingEventPublisher: IMarketingEventPublisher;
  clickIdStore: IClickIdStore;
  attributionStore: IAttributionStore;
  marketingAttributionEnabled: boolean;
};

export function createComplianceMarketing(input: {
  env: Env;
  db: Database;
  infra: ContainerInfra;
}): ComplianceMarketingSlice {
  const { env, db, infra } = input;
  const { redis, marketingEventsBullQueue } = infra;
  const marketingConfig = getMarketingEventsConfig(env);
  const marketingEnabled = marketingConfig !== undefined;
  const clickIdStore: IClickIdStore = marketingEnabled
    ? new CachedClickIdStore(new PostgresClickIdStore(db), new RedisClickIdStore(redis))
    : new RedisClickIdStore(redis);
  // Keep deletion available even while publisher/enrichment flags are disabled.
  const attributionStore: IAttributionStore = new CachedAttributionStore(
    new PostgresAttributionStore(db),
    new RedisAttributionStore(redis),
  );
  const marketingAttributionEnabled = isMarketingAttributionEnabled(env);
  const marketingOutbox = marketingEnabled
    ? new DrizzleMarketingEventOutboxRepository(db)
    : new NoopMarketingEventOutboxRepository();
  const marketingConsentGate = new EventMarketingConsentGate();
  const marketingEventQueue = marketingEnabled
    ? new BullmqMarketingEventQueue(marketingEventsBullQueue)
    : new NoopMarketingEventQueue();
  const marketingEventPublisher: IMarketingEventPublisher = marketingConfig
    ? new CompositeMarketingEventPublisher(
        new SgtmMarketingEventPublisher(
          marketingConfig.sgtmEndpointUrl,
          marketingConfig.ga4MeasurementId,
        ),
        new MetaCapiMarketingEventPublisher(
          marketingConfig.metaPixelId,
          marketingConfig.metaCapiAccessToken,
          marketingConfig.metaCapiTestEventCode,
          marketingConfig.metaGraphApiVersion,
        ),
        new InMemoryCircuitBreaker(),
      )
    : new NoopMarketingEventPublisher();
  const marketingEventService = new MarketingEventService(
    marketingOutbox,
    marketingEventQueue,
    marketingConsentGate,
  );
  return {
    marketingEventService,
    marketingEventPublisher,
    clickIdStore,
    attributionStore,
    marketingAttributionEnabled,
  };
}
