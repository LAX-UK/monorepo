import { join } from "node:path";
import type { Database } from "@auction/db";
import {
  ConsoleEmailService,
  type IEmailService,
  PostmarkEmailService,
  bindEmailQueue,
} from "@auction/email";
import { getBullMqTelemetry } from "@auction/observability";
import {
  DATA_EXPORT_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  IMAGE_CLEANUP_QUEUE_NAME,
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
  type LegalEntityArchiveJobData,
  MARKETING_EVENTS_QUEUE_NAME,
  MARKETING_SYNC_QUEUE_NAME,
  PAYOUT_STATEMENTS_QUEUE_NAME,
  QR_CODE_SCAN_QUEUE_NAME,
  type QueueName,
  VALIDATE_UPLOAD_QUEUE_NAME,
  WEBHOOK_EVENTS_QUEUE_NAME,
  type WebhookEventsJobData,
  type WebhookEventsQueueProducer,
  bindLegalEntityArchiveQueue,
  bindWebhookEventsQueue,
  createBullQueueOptions,
} from "@auction/queues";
import { Queue } from "bullmq";
import type { Redis, RedisOptions } from "ioredis";
import type { Env } from "../env.js";
import { LocalDiskObjectStorage } from "../infrastructure/local-disk-object-storage.js";
import { RedisCacheProvider } from "../infrastructure/redis-cache.provider.js";
import { RedisLuaRateLimitStore } from "../infrastructure/redis-lua-rate-limit.store.js";
import { S3ObjectStorage } from "../infrastructure/s3-object-storage.js";
import { createRedisConnectionFactory } from "../lib/redis-connection-factory.js";
import { connectionOptionsFromRedisUrl } from "../lib/redis-url.js";
import { StripeClientFactory } from "../lib/stripe-client.js";
import { StripeWebhookVerifier } from "../lib/stripe-webhook-verifier.js";
import type { ICacheProvider } from "../services/interfaces/cache.js";
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";

export type ContainerInfra = {
  redis: Redis;
  redisCache: Redis;
  rateLimitStore: IRateLimitStore;
  cache: ICacheProvider;
  bullConnection: RedisOptions;
  queueOpts: (name: QueueName) => ReturnType<typeof createBullQueueOptions>;
  emailQueue: Queue<{ outboxId: string }>;
  emailService: IEmailService;
  objectStorage: IObjectStorage;
  stripeClientFactory: StripeClientFactory;
  stripeWebhookVerifier: StripeWebhookVerifier;
  uploadValidationQueue: Queue;
  imageCleanupQueue: Queue;
  qrCodeScanQueue: Queue;
  marketingSyncQueue: Queue;
  marketingEventsBullQueue: Queue;
  payoutStatementQueue: Queue;
  dataExportQueue: Queue;
  legalEntityArchiveQueue: ReturnType<typeof bindLegalEntityArchiveQueue>;
  webhookEventsQueue: Queue<WebhookEventsJobData>;
  webhookEventsProducer: WebhookEventsQueueProducer;
};

export function createInfra(env: Env, db: Database): ContainerInfra {
  const redisFactory = createRedisConnectionFactory(env.REDIS_URL);
  const redisCache = redisFactory.getClient("cache");
  const redis = redisFactory.getClient("pubsub");
  const bullConnection: RedisOptions = {
    ...connectionOptionsFromRedisUrl(env.REDIS_URL),
    maxRetriesPerRequest: null,
  };
  const bullTelemetry = getBullMqTelemetry("auction-api");
  const bullQueueBase = {
    connection: bullConnection,
    ...(bullTelemetry ? { telemetry: bullTelemetry } : {}),
  };
  const queueOpts = (name: QueueName) => createBullQueueOptions(name, bullQueueBase);
  const emailQueue = new Queue<{ outboxId: string }>(EMAIL_QUEUE_NAME, queueOpts(EMAIL_QUEUE_NAME));
  const boundEmailQueue = bindEmailQueue(emailQueue);
  const emailService: IEmailService =
    env.EMAIL_PROVIDER === "postmark"
      ? new PostmarkEmailService(db, boundEmailQueue)
      : new ConsoleEmailService(db, boundEmailQueue);
  const cache = new RedisCacheProvider(redisCache);
  const rateLimitStore = new RedisLuaRateLimitStore(redisCache);
  const uploadValidationQueue = new Queue(
    VALIDATE_UPLOAD_QUEUE_NAME,
    queueOpts(VALIDATE_UPLOAD_QUEUE_NAME),
  );
  const imageCleanupQueue = new Queue(
    IMAGE_CLEANUP_QUEUE_NAME,
    queueOpts(IMAGE_CLEANUP_QUEUE_NAME),
  );
  const qrCodeScanQueue = new Queue(QR_CODE_SCAN_QUEUE_NAME, queueOpts(QR_CODE_SCAN_QUEUE_NAME));
  const marketingSyncQueue = new Queue(
    MARKETING_SYNC_QUEUE_NAME,
    queueOpts(MARKETING_SYNC_QUEUE_NAME),
  );
  const marketingEventsBullQueue = new Queue(
    MARKETING_EVENTS_QUEUE_NAME,
    queueOpts(MARKETING_EVENTS_QUEUE_NAME),
  );
  const payoutStatementQueue = new Queue(
    PAYOUT_STATEMENTS_QUEUE_NAME,
    queueOpts(PAYOUT_STATEMENTS_QUEUE_NAME),
  );
  const dataExportQueue = new Queue(DATA_EXPORT_QUEUE_NAME, queueOpts(DATA_EXPORT_QUEUE_NAME));
  const legalEntityArchiveQueue = bindLegalEntityArchiveQueue(
    new Queue<LegalEntityArchiveJobData>(
      LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
      queueOpts(LEGAL_ENTITY_ARCHIVE_QUEUE_NAME),
    ),
  );
  const webhookEventsQueue = new Queue<WebhookEventsJobData>(
    WEBHOOK_EVENTS_QUEUE_NAME,
    queueOpts(WEBHOOK_EVENTS_QUEUE_NAME),
  );
  const webhookEventsProducer = bindWebhookEventsQueue(webhookEventsQueue);
  const publicUploadBase = `${env.API_PUBLIC_URL.replace(/\/$/, "")}/static/uploads`;
  const objectStorage: IObjectStorage =
    env.STORAGE_DRIVER === "s3"
      ? new S3ObjectStorage({
          bucket: env.S3_BUCKET as string,
          region: env.S3_REGION as string,
          endpoint: env.S3_ENDPOINT,
          accessKeyId: env.S3_ACCESS_KEY_ID as string,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
          publicBaseUrl:
            env.S3_PUBLIC_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`,
        })
      : new LocalDiskObjectStorage(join(process.cwd(), env.STORAGE_LOCAL_ROOT), publicUploadBase);
  const stripeClientFactory = new StripeClientFactory(env);
  const stripeWebhookVerifier = new StripeWebhookVerifier(stripeClientFactory, env);

  return {
    redis,
    redisCache,
    rateLimitStore,
    cache,
    bullConnection,
    queueOpts,
    emailQueue,
    emailService,
    objectStorage,
    stripeClientFactory,
    stripeWebhookVerifier,
    uploadValidationQueue,
    imageCleanupQueue,
    qrCodeScanQueue,
    marketingSyncQueue,
    marketingEventsBullQueue,
    payoutStatementQueue,
    dataExportQueue,
    legalEntityArchiveQueue,
    webhookEventsQueue,
    webhookEventsProducer,
  };
}
