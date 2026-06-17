import { createExportProviderDeps } from "@auction/api/exports";
import { closeDb, createDb } from "@auction/db";
import {
  ConsoleEmailService,
  type IEmailService,
  PostmarkEmailService,
  bindEmailQueue,
} from "@auction/email";
import {
  InMemoryCircuitBreaker,
  MetaCapiMarketingEventPublisher,
  ProfileUserIdentityResolver,
  SgtmMarketingEventPublisher,
  Sha256PiiHasher,
} from "@auction/marketing-events";
import { captureBackgroundError, getBullMqTelemetry, initNodeSentry } from "@auction/observability";
import {
  DATA_EXPORT_QUEUE_NAME,
  DEAD_LETTER_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  GC_PENDING_UPLOADS_QUEUE_NAME,
  IMAGE_CLEANUP_QUEUE_NAME,
  IMPERSONATION_SWEEPER_QUEUE_NAME,
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
  MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME,
  MARKETING_EVENTS_QUEUE_NAME,
  MARKETING_OUTBOX_POLLER_QUEUE_NAME,
  MARKETING_SYNC_QUEUE_NAME,
  PAYOUT_SETTLEMENT_QUEUE_NAME,
  PAYOUT_STATEMENTS_QUEUE_NAME,
  PROCESS_IMAGE_QUEUE_NAME,
  PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME,
  PURGE_MARKETING_CLICK_IDS_QUEUE_NAME,
  PURGE_QR_CODE_SCANS_QUEUE_NAME,
  PURGE_SOFT_DELETED_USERS_QUEUE_NAME,
  QR_CODE_SCAN_QUEUE_NAME,
  QUEUE_REGISTRY,
  type QueueName,
  VALIDATE_UPLOAD_QUEUE_NAME,
  WEBHOOK_EVENTS_QUEUE_NAME,
  createBullQueueOptions,
  listWorkerHeartbeatKeys,
  registerDlqHandlers,
} from "@auction/queues";
import type { DataExportJobPayload, QrCodeScanJobPayload } from "@auction/queues";
import type { MarketingEvent, ResolvedMarketingEvent } from "@auction/types";
import { serve } from "@hono/node-server";
import { type Job, Queue, Worker } from "bullmq";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { Redis } from "ioredis";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { loadWorkerEnv } from "./env.js";
import { ConsoleEmailSender, PostmarkEmailSender } from "./infrastructure/postmark-email.sender.js";
import { runBulkPayoutSettlementJob } from "./jobs/bulk-payout-settlement.js";
import { runCleanupDisplayPairingsJob } from "./jobs/cleanup-display-pairings.js";
import { dataExportJob } from "./jobs/data-export.js";
import {
  type GeneratePayoutStatementJobData,
  generatePayoutStatementJob,
} from "./jobs/generate-payout-statement.js";
import { cleanupImageJob } from "./jobs/image-cleanup.js";
import { runImpersonationSweeperJob } from "./jobs/impersonation-sweeper.js";
import { runLegalEntityArchiveCascadeJob } from "./jobs/legal-entity-archive-cascade.js";
import { runLotLifecycleTickJob } from "./jobs/lot-lifecycle-tick.js";
import {
  type MarketingContactSyncJobData,
  marketingContactSyncJob,
} from "./jobs/marketing-contact-sync.js";
import {
  applyMarketingPublishOutcome,
  marketingEventsOutcomeTotal,
  processMarketingEventJob,
  runMarketingEventOutboxPoller,
} from "./jobs/marketing-event-processor.js";
import {
  runExpireStalePaymentsJob,
  runProcessNotificationOutboxJob,
  runRefreshXeroTokensJob,
  runRetryRefundReconcilesJob,
  runRetryXeroStripeCaptureSyncJob,
  runRetryXeroWebhookFailuresJob,
} from "./jobs/payment-ops-cron.js";
import { processImageJob } from "./jobs/process-image.js";
import { purgeExpiredExportsJob } from "./jobs/purge-expired-exports.js";
import { purgeExpiredVerifications } from "./jobs/purge-expired-verifications.js";
import { purgeQrCodeScans } from "./jobs/purge-qr-code-scans.js";
import { purgeSoftDeletedUsers } from "./jobs/purge-soft-deleted-users.js";
import { purgeSourceOfFundsDocumentsJob } from "./jobs/purge-source-of-funds-documents.js";
import { purgeStaleMarketingClickIds } from "./jobs/purge-stale-marketing-click-ids.js";
import { purgeStaleMarketingOutbox } from "./jobs/purge-stale-marketing-outbox.js";
import { recordQrCodeScanJob } from "./jobs/qr-code-scan.js";
import {
  type SendEmailJobData,
  enqueueStaleEmailOutboxRows,
  sendEmailJob,
} from "./jobs/send-email.js";
import { runStaleSubmissionDraftRemindersJob } from "./jobs/stale-submission-draft-reminders.js";
import { gcPendingUploads, validateUploadJob } from "./jobs/validate-upload.js";
import { type ZohoCampaignsSyncJobData, zohoCampaignsSyncJob } from "./jobs/zoho-campaigns-sync.js";
import {
  ClamAvHttpMalwareScanner,
  ClamAvMalwareScanner,
  NoOpMalwareScanner,
} from "./lib/malware-scanner.js";
import { createMarketingContactSync } from "./lib/marketing-contact-sync/index.js";
import {
  getMarketingEventsConfig,
  isMarketingEventsEnabled,
} from "./lib/marketing-events-enabled.js";
import { queueRuntimeEnvFromWorkerEnv } from "./lib/queue-runtime-env.js";
import { loadSentryMonitorSlugs, withSentryCronMonitor } from "./lib/sentry-cron.js";
import { SharpImageProcessor } from "./lib/sharp-image-processor.js";
import { createUploadStorage } from "./lib/upload-storage.js";
import { CachedClickIdStore } from "./marketing/cached-click-id.store.js";
import { DrizzleProfileMarketingReader } from "./marketing/drizzle-profile.reader.js";
import {
  MetaCapiBatchCollector,
  marketingEventsCapiBatchSize,
} from "./marketing/meta-capi-batch-collector.js";
import { PostgresClickIdStore } from "./marketing/postgres-click-id.store.js";
import { RedisClickIdStore } from "./marketing/redis-click-id.store.js";
import { createProjectorRunner } from "./projectors/runner.js";
import { syncXeroPayoutBillViaApi } from "./projectors/xero-payout-bill-sync.js";

const env = loadWorkerEnv();
if (env.EMAIL_PROVIDER === "postmark" && !env.POSTMARK_SERVER_TOKEN?.trim()) {
  console.error("FATAL: EMAIL_PROVIDER=postmark but POSTMARK_SERVER_TOKEN is empty");
  process.exit(1);
}
if (env.SENTRY_DSN_WORKER) {
  initNodeSentry({
    dsn: env.SENTRY_DSN_WORKER,
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1,
  });
}

const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "auction-worker", env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});
const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
});
redis.on("error", (err: Error) => {
  log.error({ err }, "redis connection error");
});
const bullTelemetry = getBullMqTelemetry("auction-worker");
const bullConnection = bullTelemetry
  ? { connection: redis, telemetry: bullTelemetry }
  : { connection: redis };
const queueOpts = (name: QueueName) => createBullQueueOptions(name, bullConnection);
const uploadStorage = createUploadStorage(env);
const malwareScanner =
  env.CLAMAV_URL != null
    ? new ClamAvHttpMalwareScanner(env.CLAMAV_URL, (key, max) =>
        uploadStorage.getObjectBytes(key, max),
      )
    : env.CLAMAV_HOST != null
      ? new ClamAvMalwareScanner(env.CLAMAV_HOST, env.CLAMAV_PORT, (key, max) =>
          uploadStorage.getObjectBytes(key, max),
        )
      : new NoOpMalwareScanner();
if (env.CLAMAV_URL == null && env.CLAMAV_HOST == null) {
  log.warn(
    {
      appEnv: env.APP_ENV,
      scanner: "NoOpMalwareScanner",
    },
    "ClamAV is not configured: Source-of-Funds document uploads will NOT be malware-scanned",
  );
}
const imageProcessor = new SharpImageProcessor();
const publicUploadBase =
  env.STORAGE_DRIVER === "s3" && env.S3_BUCKET && env.S3_REGION
    ? (env.S3_PUBLIC_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`)
    : undefined;
const bootedAt = Date.now();
const sentryMonitorSlugs = loadSentryMonitorSlugs();

function reportWorkerJobFailure(queue: string, job: { id?: string } | undefined, err: Error): void {
  log.warn({ jobId: job?.id, err, queue }, "worker job failed");
  captureBackgroundError(`worker-${queue}`, err, { extra: { jobId: job?.id } });
}

function registerWorkerErrorHandlers(workers: Array<{ worker: Worker; queue: string }>): void {
  for (const { worker, queue } of workers) {
    worker.on("error", (err: Error) => {
      log.error({ err, queue }, "bullmq worker error");
    });
  }
}

/** BullMQ `repeat.pattern` uses cron-parser; Monday 09:00 UTC. */
const BULK_PAYOUT_SETTLEMENT_CRON_PATTERN = "0 9 * * 1";

function nextBulkPayoutSettlementRunUtc(from = new Date()): Date {
  const hourUtc = 9;
  const targetDow = 1; // Monday
  const candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hourUtc, 0, 0, 0),
  );
  let addDays = (targetDow - candidate.getUTCDay() + 7) % 7;
  if (addDays === 0 && from.getTime() >= candidate.getTime()) {
    addDays = 7;
  }
  candidate.setUTCDate(candidate.getUTCDate() + addDays);
  return candidate;
}

const heartbeatKeys = listWorkerHeartbeatKeys(queueRuntimeEnvFromWorkerEnv(env));
async function heartbeat(queue: string) {
  await redis.set(`worker:heartbeat:${queue}`, String(Date.now()), "EX", 600);
}

const webhookWorker = new Worker(
  WEBHOOK_EVENTS_QUEUE_NAME,
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, "processed webhook job");
    await heartbeat("webhook-events");
  },
  bullConnection,
);
webhookWorker.on("completed", () => void heartbeat("webhook-events"));
webhookWorker.on("failed", (job, err) => {
  reportWorkerJobFailure(WEBHOOK_EVENTS_QUEUE_NAME, job, err);
});

const processImageQueue = new Queue(PROCESS_IMAGE_QUEUE_NAME, queueOpts(PROCESS_IMAGE_QUEUE_NAME));

const validateUploadWorker = new Worker(
  VALIDATE_UPLOAD_QUEUE_NAME,
  async (job) => {
    const uploadId = String((job.data as { uploadId?: unknown }).uploadId ?? "");
    if (!uploadId) {
      throw new Error("validate-upload job is missing uploadId");
    }
    const result = await validateUploadJob({
      db,
      storage: uploadStorage,
      uploadId,
      log,
      malwareScanner,
    });
    if (result.validated && result.key) {
      await processImageQueue.add("process-image", { key: result.key });
    }
    await heartbeat("validate-upload");
  },
  bullConnection,
);
validateUploadWorker.on("completed", () => void heartbeat("validate-upload"));
validateUploadWorker.on("failed", (job, err) => {
  reportWorkerJobFailure("validate-upload", job, err);
});

const processImageWorker = new Worker(
  PROCESS_IMAGE_QUEUE_NAME,
  async (job) => {
    const key = String((job.data as { key?: unknown }).key ?? "");
    if (!key) {
      throw new Error("process-image job is missing key");
    }
    await processImageJob({ db, storage: uploadStorage, processor: imageProcessor, key, log });
    await heartbeat("process-image");
  },
  bullConnection,
);
processImageWorker.on("completed", () => void heartbeat("process-image"));
processImageWorker.on("failed", (job, err) => {
  reportWorkerJobFailure("process-image", job, err);
});

const imageCleanupWorker = new Worker(
  IMAGE_CLEANUP_QUEUE_NAME,
  async (job) => {
    const key = String((job.data as { key?: unknown }).key ?? "");
    if (!key) {
      throw new Error("image-cleanup job is missing key");
    }
    await cleanupImageJob({
      db,
      storage: uploadStorage,
      key,
      publicBaseUrl: publicUploadBase,
      log,
    });
    await heartbeat("image-cleanup");
  },
  bullConnection,
);
imageCleanupWorker.on("completed", () => void heartbeat("image-cleanup"));
imageCleanupWorker.on("failed", (job, err) => {
  reportWorkerJobFailure(IMAGE_CLEANUP_QUEUE_NAME, job, err);
});

const qrCodeScanWorker = new Worker<QrCodeScanJobPayload>(
  QR_CODE_SCAN_QUEUE_NAME,
  async (job) => {
    await recordQrCodeScanJob({ db, data: job.data, log });
    await heartbeat("qr-code-scan");
  },
  {
    ...bullConnection,
    concurrency: 10,
    limiter: { max: 300, duration: 1000 },
  },
);
qrCodeScanWorker.on("completed", () => void heartbeat("qr-code-scan"));
qrCodeScanWorker.on("failed", (job, err) => {
  reportWorkerJobFailure(QR_CODE_SCAN_QUEUE_NAME, job, err);
});

const gcUploadQueue = new Queue(
  GC_PENDING_UPLOADS_QUEUE_NAME,
  queueOpts(GC_PENDING_UPLOADS_QUEUE_NAME),
);
const gcPendingUploadsWorker = new Worker(
  GC_PENDING_UPLOADS_QUEUE_NAME,
  async () => {
    await withSentryCronMonitor("gc-pending-uploads", sentryMonitorSlugs, async () => {
      await gcPendingUploads({ db, storage: uploadStorage, log });
      await purgeSourceOfFundsDocumentsJob({ db, storage: uploadStorage, log });
      await heartbeat("gc-pending-uploads");
    });
  },
  bullConnection,
);
gcPendingUploadsWorker.on("completed", () => void heartbeat("gc-pending-uploads"));
void gcUploadQueue.add(
  "gc-pending-uploads",
  {},
  { jobId: "hourly-gc-pending-uploads", repeat: { every: 60 * 60 * 1000 } },
);

const emailSender =
  env.EMAIL_PROVIDER === "postmark"
    ? new PostmarkEmailSender({
        serverToken: env.POSTMARK_SERVER_TOKEN ?? "",
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO,
        transactionalStream: env.POSTMARK_TRANSACTIONAL_STREAM,
        broadcastStream: env.POSTMARK_BROADCAST_STREAM,
      })
    : new ConsoleEmailSender();

type EmailQueueJobData = SendEmailJobData | Record<string, never>;
const emailQueue = new Queue<EmailQueueJobData>(EMAIL_QUEUE_NAME, queueOpts(EMAIL_QUEUE_NAME));

const emailOutboxService: IEmailService =
  env.EMAIL_PROVIDER === "postmark"
    ? new PostmarkEmailService(db, bindEmailQueue(emailQueue as Queue<{ outboxId: string }>))
    : new ConsoleEmailService(db, bindEmailQueue(emailQueue as Queue<{ outboxId: string }>));
const emailWorker = new Worker<EmailQueueJobData>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    if (job.name === "outbox-drain") {
      await withSentryCronMonitor("email-outbox-drain", sentryMonitorSlugs, async () => {
        const count = await enqueueStaleEmailOutboxRows({ db, queue: emailQueue });
        log.info({ count }, "email outbox drain completed");
        await heartbeat("email");
      });
      return;
    }
    await sendEmailJob({ db, sender: emailSender, log }, job.data as SendEmailJobData);
    await heartbeat("email");
  },
  {
    ...bullConnection,
    concurrency: 10,
    limiter: { max: 50, duration: 1000 },
  },
);
emailWorker.on("completed", () => void heartbeat("email"));
emailWorker.on("failed", (job, err) => {
  reportWorkerJobFailure("email", job, err);
});
void emailQueue.add(
  "outbox-drain",
  {},
  { jobId: "email-outbox-drain", repeat: { every: 60_000 }, removeOnComplete: 100 },
);

type MarketingSyncJobData = ZohoCampaignsSyncJobData | MarketingContactSyncJobData;
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

  marketingCapiBatchQueue = new Queue<ResolvedMarketingEvent>(
    MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME,
    queueOpts(MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME),
  );
  const capiBatchQueue = marketingCapiBatchQueue;
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

type PayoutStatementJobData = GeneratePayoutStatementJobData;
const payoutStatementQueue = new Queue<PayoutStatementJobData>(
  PAYOUT_STATEMENTS_QUEUE_NAME,
  queueOpts(PAYOUT_STATEMENTS_QUEUE_NAME),
);
const payoutStatementWorker = new Worker<PayoutStatementJobData>(
  PAYOUT_STATEMENTS_QUEUE_NAME,
  async (job) => {
    await generatePayoutStatementJob({ db, storage: uploadStorage, env, log, job });
    await heartbeat("payout-statements");
  },
  {
    ...bullConnection,
    concurrency: 2,
    limiter: { max: 20, duration: 1000 },
  },
);
payoutStatementWorker.on("completed", () => void heartbeat("payout-statements"));

const exportProviderDeps = createExportProviderDeps(db);
const dataExportQueue = new Queue(DATA_EXPORT_QUEUE_NAME, queueOpts(DATA_EXPORT_QUEUE_NAME));
const dataExportWorker = new Worker(
  DATA_EXPORT_QUEUE_NAME,
  async (job) => {
    if (job.name === "purge-expired") {
      await purgeExpiredExportsJob({ db, storage: uploadStorage, log });
      return;
    }
    await dataExportJob(
      { db, redis, storage: uploadStorage, providerDeps: exportProviderDeps, log },
      job as Job<DataExportJobPayload>,
    );
    await heartbeat("data-export");
  },
  {
    ...bullConnection,
    concurrency: 2,
    limiter: { max: 10, duration: 1000 },
  },
);
dataExportWorker.on("completed", () => void heartbeat("data-export"));
dataExportWorker.on("failed", (job, err) => {
  reportWorkerJobFailure(DATA_EXPORT_QUEUE_NAME, job, err);
});
void dataExportQueue.add(
  "purge-expired",
  {},
  {
    jobId: "purge-expired-exports-daily",
    repeat: { every: 24 * 60 * 60 * 1000 },
    removeOnComplete: 5,
  },
);

type LegalEntityArchiveJobData = { legalEntityId: string };
const legalEntityArchiveQueue = new Queue<LegalEntityArchiveJobData>(
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
  queueOpts(LEGAL_ENTITY_ARCHIVE_QUEUE_NAME),
);
const legalEntityArchiveWorker = new Worker<LegalEntityArchiveJobData>(
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
  async (job) => {
    const legalEntityId = String(job.data?.legalEntityId ?? "");
    if (!legalEntityId) {
      throw new Error("legal-entity-archive job is missing legalEntityId");
    }
    await runLegalEntityArchiveCascadeJob({
      db,
      emailService: emailOutboxService,
      log,
      webOrigin: env.WEB_ORIGIN,
      supportContactEmail: env.EMAIL_REPLY_TO ?? "support@lax.bid",
      legalEntityId,
    });
    await heartbeat("legal-entity-archive");
  },
  bullConnection,
);
legalEntityArchiveWorker.on("completed", () => void heartbeat("legal-entity-archive"));

const impersonationSweeperQueue = new Queue(
  IMPERSONATION_SWEEPER_QUEUE_NAME,
  queueOpts(IMPERSONATION_SWEEPER_QUEUE_NAME),
);
const impersonationSweeperWorker = new Worker(
  IMPERSONATION_SWEEPER_QUEUE_NAME,
  async () => {
    await withSentryCronMonitor("impersonation-sweeper", sentryMonitorSlugs, async () => {
      await runImpersonationSweeperJob({ db, log });
      await heartbeat("impersonation-sweeper");
    });
  },
  bullConnection,
);
impersonationSweeperWorker.on("completed", () => void heartbeat("impersonation-sweeper"));
void impersonationSweeperQueue.add(
  "sweep-stale-impersonations",
  {},
  {
    jobId: "impersonation-sweeper-repeat",
    repeat: { every: 6 * 60 * 60 * 1000 },
    removeOnComplete: 10,
  },
);

const purgeVerificationsQueue = new Queue(
  PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME,
  queueOpts(PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME),
);
const purgeVerificationsWorker = new Worker(
  PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME,
  async () => {
    await withSentryCronMonitor("purge-expired-verifications", sentryMonitorSlugs, async () => {
      const { deleted } = await purgeExpiredVerifications(db, { log });
      log.info({ deleted }, "purge-expired-verifications: done");
      await heartbeat("purge-expired-verifications");
    });
  },
  bullConnection,
);
purgeVerificationsWorker.on("completed", () => void heartbeat("purge-expired-verifications"));
void purgeVerificationsQueue.add(
  "purge",
  {},
  {
    jobId: "purge-expired-verifications-6h",
    repeat: { every: 6 * 60 * 60 * 1000 },
    removeOnComplete: 10,
  },
);

const purgeSoftDeletedUsersQueue = new Queue(
  PURGE_SOFT_DELETED_USERS_QUEUE_NAME,
  queueOpts(PURGE_SOFT_DELETED_USERS_QUEUE_NAME),
);
const purgeSoftDeletedUsersWorker = new Worker(
  PURGE_SOFT_DELETED_USERS_QUEUE_NAME,
  async () => {
    await withSentryCronMonitor("purge-soft-deleted-users", sentryMonitorSlugs, async () => {
      const { processed } = await purgeSoftDeletedUsers(db, { log });
      log.info({ processed }, "purge-soft-deleted-users: done");
    });
  },
  bullConnection,
);
purgeSoftDeletedUsersWorker.on("failed", (job, err) => {
  reportWorkerJobFailure("purge-soft-deleted-users", job, err);
});
// Run weekly; deletions take 30 days to become eligible anyway.
void purgeSoftDeletedUsersQueue.add(
  "purge",
  {},
  {
    jobId: "purge-soft-deleted-users-weekly",
    repeat: { every: 7 * 24 * 60 * 60 * 1000 },
    removeOnComplete: 10,
  },
);

const purgeQrCodeScansQueue = new Queue(
  PURGE_QR_CODE_SCANS_QUEUE_NAME,
  queueOpts(PURGE_QR_CODE_SCANS_QUEUE_NAME),
);
const purgeQrCodeScansWorker = new Worker(
  PURGE_QR_CODE_SCANS_QUEUE_NAME,
  async () => {
    await withSentryCronMonitor("purge-qr-code-scans", sentryMonitorSlugs, async () => {
      const { deleted } = await purgeQrCodeScans({
        db,
        log,
        retentionDays: env.QR_SCAN_RETENTION_DAYS,
      });
      log.info({ deleted, retentionDays: env.QR_SCAN_RETENTION_DAYS }, "purge-qr-code-scans: done");
    });
  },
  bullConnection,
);
purgeQrCodeScansWorker.on("failed", (job, err) => {
  reportWorkerJobFailure(PURGE_QR_CODE_SCANS_QUEUE_NAME, job, err);
});
void purgeQrCodeScansQueue.add(
  "purge",
  {},
  {
    jobId: "purge-qr-code-scans-daily",
    repeat: { every: 24 * 60 * 60 * 1000 },
    removeOnComplete: 5,
  },
);

let payoutSettlementQueue: Queue | undefined;
let payoutSettlementWorker: Worker | undefined;
if (env.CRON_INTERNAL_SECRET) {
  const cronSecret = env.CRON_INTERNAL_SECRET;
  payoutSettlementQueue = new Queue(
    PAYOUT_SETTLEMENT_QUEUE_NAME,
    queueOpts(PAYOUT_SETTLEMENT_QUEUE_NAME),
  );
  payoutSettlementWorker = new Worker(
    PAYOUT_SETTLEMENT_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor("payout-settlement", sentryMonitorSlugs, async () => {
        await runBulkPayoutSettlementJob({
          apiBaseUrl: env.API_INTERNAL_BASE_URL,
          cronSecret,
          log,
        });
        await heartbeat("payout-settlement");
      });
    },
    bullConnection,
  );
  payoutSettlementWorker.on("completed", () => void heartbeat("payout-settlement"));
  void payoutSettlementQueue.add(
    "bulk-payout-settlement",
    {},
    {
      jobId: "weekly-bulk-payout-settlement-mon-0900-utc",
      repeat: { pattern: BULK_PAYOUT_SETTLEMENT_CRON_PATTERN, tz: "UTC" },
      removeOnComplete: 50,
    },
  );
  const nextAt = nextBulkPayoutSettlementRunUtc();
  log.info(
    {
      repeatPattern: BULK_PAYOUT_SETTLEMENT_CRON_PATTERN,
      tz: "UTC",
      nextRunAtUtc: nextAt.toISOString(),
    },
    `payout-settlement repeat registered; next run at [${nextAt.toISOString()}] (Monday 09:00 UTC)`,
  );
}

const STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME = "stale-submission-draft-reminders";
const LOT_LIFECYCLE_TICK_QUEUE_NAME = "lot-lifecycle-tick";

let lotLifecycleTickQueue: Queue | undefined;
let lotLifecycleTickWorker: Worker | undefined;
if (env.CRON_INTERNAL_SECRET) {
  const cronSecret = env.CRON_INTERNAL_SECRET;
  lotLifecycleTickQueue = new Queue(LOT_LIFECYCLE_TICK_QUEUE_NAME, bullConnection);
  lotLifecycleTickWorker = new Worker(
    LOT_LIFECYCLE_TICK_QUEUE_NAME,
    async () => {
      await runLotLifecycleTickJob({
        apiBaseUrl: env.API_INTERNAL_BASE_URL,
        cronSecret,
        log,
      });
      await heartbeat("lot-lifecycle-tick");
    },
    bullConnection,
  );
  lotLifecycleTickWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(LOT_LIFECYCLE_TICK_QUEUE_NAME, job, err);
  });
  void lotLifecycleTickQueue.add(
    "lot-lifecycle-tick",
    {},
    {
      jobId: "lot-lifecycle-tick-10s",
      repeat: { every: 10_000 },
      removeOnComplete: 100,
    },
  );
  log.info("lot-lifecycle-tick repeat registered (every 10s)");
}

const paymentOpsCronWorkers: { worker: Worker; queue: string }[] = [];
if (env.CRON_INTERNAL_SECRET) {
  const cronSecret = env.CRON_INTERNAL_SECRET;
  const apiCronBase = {
    apiBaseUrl: env.API_INTERNAL_BASE_URL,
    cronSecret,
    log,
  };

  const registerPaymentOpsCron = (opts: {
    queueName: string;
    jobName: string;
    jobId: string;
    everyMs: number;
    sentrySlug: string;
    run: () => Promise<void>;
  }) => {
    const queue = new Queue(opts.queueName, bullConnection);
    const worker = new Worker(
      opts.queueName,
      async () => {
        await withSentryCronMonitor(opts.sentrySlug, sentryMonitorSlugs, async () => {
          await opts.run();
          await heartbeat(opts.queueName);
        });
      },
      bullConnection,
    );
    worker.on("failed", (job, err) => {
      reportWorkerJobFailure(opts.queueName, job, err);
    });
    void queue.add(
      opts.jobName,
      {},
      {
        jobId: opts.jobId,
        repeat: { every: opts.everyMs },
        removeOnComplete: 50,
      },
    );
    paymentOpsCronWorkers.push({ worker, queue: opts.queueName });
    log.info(`${opts.queueName} repeat registered (every ${opts.everyMs}ms)`);
  };

  registerPaymentOpsCron({
    queueName: "expire-stale-payments",
    jobName: "expire-stale-payments",
    jobId: "expire-stale-payments-5m",
    everyMs: 5 * 60 * 1000,
    sentrySlug: "expire-stale-payments",
    run: () => runExpireStalePaymentsJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-xero-webhook-failures",
    jobName: "retry-xero-webhook-failures",
    jobId: "retry-xero-webhook-failures-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-xero-webhook-failures",
    run: () => runRetryXeroWebhookFailuresJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-xero-stripe-capture-sync",
    jobName: "retry-xero-stripe-capture-sync",
    jobId: "retry-xero-stripe-capture-sync-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-xero-stripe-capture-sync",
    run: () => runRetryXeroStripeCaptureSyncJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "retry-refund-reconciles",
    jobName: "retry-refund-reconciles",
    jobId: "retry-refund-reconciles-15m",
    everyMs: 15 * 60 * 1000,
    sentrySlug: "retry-refund-reconciles",
    run: () => runRetryRefundReconcilesJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "refresh-xero-tokens",
    jobName: "refresh-xero-tokens",
    jobId: "refresh-xero-tokens-6h",
    everyMs: 6 * 60 * 60 * 1000,
    sentrySlug: "refresh-xero-tokens",
    run: () => runRefreshXeroTokensJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "process-notification-outbox",
    jobName: "process-notification-outbox",
    jobId: "process-notification-outbox-1m",
    everyMs: 60 * 1000,
    sentrySlug: "process-notification-outbox",
    run: () => runProcessNotificationOutboxJob(apiCronBase),
  });
  registerPaymentOpsCron({
    queueName: "cleanup-display-pairings",
    jobName: "cleanup-display-pairings",
    jobId: "cleanup-display-pairings-1h",
    everyMs: 60 * 60 * 1000,
    sentrySlug: "cleanup-display-pairings",
    run: () => runCleanupDisplayPairingsJob(apiCronBase),
  });
}

let staleSubmissionDraftRemindersQueue: Queue | undefined;
let staleSubmissionDraftRemindersWorker: Worker | undefined;
if (env.CRON_INTERNAL_SECRET) {
  const cronSecret = env.CRON_INTERNAL_SECRET;
  staleSubmissionDraftRemindersQueue = new Queue(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    bullConnection,
  );
  staleSubmissionDraftRemindersWorker = new Worker(
    STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
    async () => {
      await withSentryCronMonitor(
        "stale-submission-draft-reminders",
        sentryMonitorSlugs,
        async () => {
          await runStaleSubmissionDraftRemindersJob({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret,
            log,
          });
          await heartbeat("stale-submission-draft-reminders");
        },
      );
    },
    bullConnection,
  );
  staleSubmissionDraftRemindersWorker.on("failed", (job, err) => {
    reportWorkerJobFailure(STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME, job, err);
  });
  void staleSubmissionDraftRemindersQueue.add(
    "stale-submission-draft-reminders",
    {},
    {
      jobId: "daily-stale-submission-draft-reminders",
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: 50,
    },
  );
  log.info("stale-submission-draft-reminders repeat registered (daily)");
}

registerWorkerErrorHandlers([
  { worker: webhookWorker, queue: WEBHOOK_EVENTS_QUEUE_NAME },
  { worker: validateUploadWorker, queue: VALIDATE_UPLOAD_QUEUE_NAME },
  { worker: processImageWorker, queue: PROCESS_IMAGE_QUEUE_NAME },
  { worker: imageCleanupWorker, queue: IMAGE_CLEANUP_QUEUE_NAME },
  { worker: qrCodeScanWorker, queue: QR_CODE_SCAN_QUEUE_NAME },
  { worker: gcPendingUploadsWorker, queue: GC_PENDING_UPLOADS_QUEUE_NAME },
  { worker: emailWorker, queue: EMAIL_QUEUE_NAME },
  { worker: marketingSyncWorker, queue: MARKETING_SYNC_QUEUE_NAME },
  { worker: payoutStatementWorker, queue: PAYOUT_STATEMENTS_QUEUE_NAME },
  { worker: dataExportWorker, queue: DATA_EXPORT_QUEUE_NAME },
  { worker: legalEntityArchiveWorker, queue: LEGAL_ENTITY_ARCHIVE_QUEUE_NAME },
  { worker: impersonationSweeperWorker, queue: IMPERSONATION_SWEEPER_QUEUE_NAME },
  { worker: purgeVerificationsWorker, queue: PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME },
  { worker: purgeSoftDeletedUsersWorker, queue: PURGE_SOFT_DELETED_USERS_QUEUE_NAME },
  { worker: purgeQrCodeScansWorker, queue: PURGE_QR_CODE_SCANS_QUEUE_NAME },
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
  ...(payoutSettlementWorker
    ? [{ worker: payoutSettlementWorker, queue: PAYOUT_SETTLEMENT_QUEUE_NAME }]
    : []),
  ...(staleSubmissionDraftRemindersWorker
    ? [
        {
          worker: staleSubmissionDraftRemindersWorker,
          queue: STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
        },
      ]
    : []),
  ...(lotLifecycleTickWorker
    ? [{ worker: lotLifecycleTickWorker, queue: LOT_LIFECYCLE_TICK_QUEUE_NAME }]
    : []),
  ...paymentOpsCronWorkers,
]);

const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, queueOpts(DEAD_LETTER_QUEUE_NAME));
registerDlqHandlers(
  [
    { name: EMAIL_QUEUE_NAME, worker: emailWorker },
    { name: PAYOUT_STATEMENTS_QUEUE_NAME, worker: payoutStatementWorker },
    { name: LEGAL_ENTITY_ARCHIVE_QUEUE_NAME, worker: legalEntityArchiveWorker },
    ...(marketingEventsWorker
      ? [{ name: MARKETING_EVENTS_QUEUE_NAME, worker: marketingEventsWorker }]
      : []),
    ...(payoutSettlementWorker
      ? [{ name: PAYOUT_SETTLEMENT_QUEUE_NAME, worker: payoutSettlementWorker }]
      : []),
  ],
  (name) => QUEUE_REGISTRY[name],
  {
    dlqQueue: deadLetterQueue,
    db,
    logError: (message, context) => log.error(context, message),
  },
);

void Promise.all([
  heartbeat("webhook-events"),
  heartbeat("validate-upload"),
  heartbeat("process-image"),
  heartbeat("image-cleanup"),
  heartbeat("qr-code-scan"),
  heartbeat("gc-pending-uploads"),
  heartbeat("email"),
  heartbeat("marketing-sync"),
  ...(isMarketingEventsEnabled(env) ? [heartbeat("marketing-events")] : []),
  heartbeat("payout-statements"),
  heartbeat("legal-entity-archive"),
  heartbeat("impersonation-sweeper"),
  heartbeat("purge-expired-verifications"),
  ...(env.CRON_INTERNAL_SECRET
    ? [
        heartbeat("payout-settlement"),
        heartbeat("stale-submission-draft-reminders"),
        heartbeat("lot-lifecycle-tick"),
        heartbeat("expire-stale-payments"),
        heartbeat("retry-xero-webhook-failures"),
        heartbeat("retry-xero-stripe-capture-sync"),
        heartbeat("retry-refund-reconciles"),
        heartbeat("refresh-xero-tokens"),
        heartbeat("process-notification-outbox"),
      ]
    : []),
]);

const internalCronSecret = env.CRON_INTERNAL_SECRET;
const adminPayoutsUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/admin/payouts`;
const adminEmailAddress = env.ADMIN_EMAIL_ADDRESS ?? "admin@lax.bid";
const projectorRunner = createProjectorRunner({
  db,
  log,
  heartbeat: () => heartbeat("domain-events"),
  emailService: emailOutboxService,
  supportContactEmail: env.EMAIL_REPLY_TO ?? "support@lax.bid",
  adminPayoutsUrl,
  adminEmailAddress,
  webOrigin: env.WEB_ORIGIN,
  ...(marketingContactSync
    ? {
        enqueueMarketingContactSync: async (data: {
          userId: string;
          reason: string;
          eventId: number;
        }) => {
          await marketingSyncQueue.add(
            "marketing-contact-sync",
            { userId: data.userId, reason: data.reason } satisfies MarketingContactSyncJobData,
            {
              // Stable per-event jobId so a retried projector tick dedupes to one job.
              jobId: `marketing-contact-sync-${data.eventId}`,
              attempts: 5,
              backoff: { type: "exponential", delay: 30_000 },
              removeOnComplete: 1000,
              removeOnFail: 5000,
            },
          );
        },
      }
    : {}),
  ...(internalCronSecret
    ? {
        syncXeroPayoutBill: async (payoutId: string) =>
          syncXeroPayoutBillViaApi({
            apiBaseUrl: env.API_INTERNAL_BASE_URL,
            cronSecret: internalCronSecret,
            payoutId,
            log,
          }),
      }
    : {}),
});
void projectorRunner.start();

const metrics = new Registry();
collectDefaultMetrics({ register: metrics, prefix: "auction_worker_" });
metrics.registerMetric(marketingEventsOutcomeTotal);
metrics.registerMetric(marketingEventsCapiBatchSize);
const app = new Hono();

app.get("/health/live", (c) => c.json({ service: "auction-worker", status: "ok" }));
app.get("/health/ready", async (c) => {
  try {
    await db.execute(sql`select 1`);
    await redis.ping();
    if (Date.now() - bootedAt > 60_000) {
      const now = Date.now();
      for (const key of heartbeatKeys) {
        const raw = await redis.get(key);
        if (!raw || now - Number(raw) > 5 * 60_000) {
          return c.json(
            { service: "auction-worker", status: "degraded", staleHeartbeat: key },
            503,
          );
        }
      }
    }
    return c.json({ service: "auction-worker", status: "ok", redis: "ok", database: "ok" });
  } catch (err) {
    log.error({ err }, "worker readiness failed");
    return c.json({ service: "auction-worker", status: "degraded" }, 503);
  }
});
app.get("/metrics", async (c) =>
  c.text(await metrics.metrics(), 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  }),
);

const server = serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.PORT }, (info) => {
  log.info({ port: info.port }, "worker service listening");
});

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

function shutdown(signal: NodeJS.Signals) {
  log.info({ signal }, "draining worker");
  const timeout = setTimeout(() => process.exit(1), 30_000);
  timeout.unref();
  void drainMarketingPipeline()
    .then(() =>
      Promise.allSettled([
        webhookWorker.close(),
        validateUploadWorker.close(),
        processImageWorker.close(),
        processImageQueue.close(),
        imageCleanupWorker.close(),
        qrCodeScanWorker.close(),
        gcPendingUploadsWorker.close(),
        gcUploadQueue.close(),
        emailWorker.close(),
        emailQueue.close(),
        marketingSyncWorker.close(),
        marketingSyncQueue.close(),
        payoutStatementWorker.close(),
        payoutStatementQueue.close(),
        dataExportWorker.close(),
        dataExportQueue.close(),
        legalEntityArchiveWorker.close(),
        legalEntityArchiveQueue.close(),
        impersonationSweeperWorker.close(),
        impersonationSweeperQueue.close(),
        purgeVerificationsWorker.close(),
        purgeVerificationsQueue.close(),
        purgeSoftDeletedUsersWorker.close(),
        purgeSoftDeletedUsersQueue.close(),
        purgeQrCodeScansWorker.close(),
        purgeQrCodeScansQueue.close(),
        ...(payoutSettlementWorker ? [payoutSettlementWorker.close()] : []),
        ...(payoutSettlementQueue ? [payoutSettlementQueue.close()] : []),
        ...(staleSubmissionDraftRemindersWorker
          ? [staleSubmissionDraftRemindersWorker.close()]
          : []),
        ...(staleSubmissionDraftRemindersQueue ? [staleSubmissionDraftRemindersQueue.close()] : []),
        ...(lotLifecycleTickWorker ? [lotLifecycleTickWorker.close()] : []),
        ...(lotLifecycleTickQueue ? [lotLifecycleTickQueue.close()] : []),
        deadLetterQueue.close(),
        projectorRunner.stop(),
      ]),
    )
    .then(() => redis.quit())
    .then(() => closeDb(db))
    .finally(() => {
      server.close(() => {
        clearTimeout(timeout);
        process.exit(0);
      });
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
