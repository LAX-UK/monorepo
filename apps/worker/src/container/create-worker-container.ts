import { closeDb, createDb } from "@auction/db";
import { getBullMqTelemetry, initNodeSentry } from "@auction/observability";
import { DrizzleRepositoryFactory } from "@auction/persistence";
import {
  DEAD_LETTER_QUEUE_NAME,
  QUEUE_REGISTRY,
  type QueueName,
  createBullQueueOptions,
  listWorkerHeartbeatKeys,
  registerDlqHandlers,
} from "@auction/queues";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import pino, { type Logger } from "pino";
import { type WorkerEnv, loadWorkerEnv } from "../env.js";
import type { MarketingContactSyncJobData } from "../jobs/marketing-contact-sync.js";
import { marketingEventsOutcomeTotal } from "../jobs/marketing-event-processor.js";
import { postInternalCronJob } from "../jobs/post-internal-cron-job.js";
import {
  ClamAvHttpMalwareScanner,
  ClamAvMalwareScanner,
  NoOpMalwareScanner,
} from "../lib/malware-scanner.js";
import { isMarketingEventsEnabled } from "../lib/marketing-events-enabled.js";
import { queueRuntimeEnvFromWorkerEnv } from "../lib/queue-runtime-env.js";
import { loadSentryMonitorSlugs } from "../lib/sentry-cron.js";
import { SharpImageProcessor } from "../lib/sharp-image-processor.js";
import { createUploadStorage } from "../lib/upload-storage.js";
import { marketingEventsCapiBatchSize } from "../marketing/meta-capi-batch-collector.js";
import { createProjectorRunner } from "../projectors/runner.js";
import { syncXeroPayoutBillViaApi } from "../projectors/xero-payout-bill-sync.js";
import { registerComplianceWorkers } from "../workers/register-compliance-workers.js";
import { registerCronWorkers } from "../workers/register-cron-workers.js";
import { registerEmailWorker } from "../workers/register-email-worker.js";
import { registerMarketingWorkers } from "../workers/register-marketing-workers.js";
import { registerMediaWorkers } from "../workers/register-media-workers.js";
import { registerPayoutWorkers } from "../workers/register-payout-workers.js";
import { registerPurgeWorkers } from "../workers/register-purge-workers.js";
import { registerWebhookWorker } from "../workers/register-webhook-worker.js";
import type { WorkerBootstrapDeps, WorkerDb } from "../workers/types.js";
import {
  createReportWorkerJobFailure,
  registerWorkerErrorHandlers,
} from "../workers/worker-utils.js";
import { createWorkerRepositories } from "./create-worker-repositories.js";

export type WorkerContainer = {
  env: WorkerEnv;
  db: WorkerDb;
  redis: Redis;
  log: Logger;
  deps: WorkerBootstrapDeps;
  bootedAt: number;
  heartbeatKeys: string[];
  marketingEventsOutcomeTotal: typeof marketingEventsOutcomeTotal;
  marketingEventsCapiBatchSize: typeof marketingEventsCapiBatchSize;
  webhookWorkers: ReturnType<typeof registerWebhookWorker>;
  mediaWorkers: ReturnType<typeof registerMediaWorkers>;
  emailWorkers: ReturnType<typeof registerEmailWorker>;
  marketingWorkers: ReturnType<typeof registerMarketingWorkers>;
  payoutWorkers: ReturnType<typeof registerPayoutWorkers>;
  complianceWorkers: ReturnType<typeof registerComplianceWorkers>;
  purgeWorkers: ReturnType<typeof registerPurgeWorkers>;
  cronWorkers: ReturnType<typeof registerCronWorkers>;
  deadLetterQueue: Queue;
  projectorRunner: ReturnType<typeof createProjectorRunner>;
};

export function createWorkerContainer(): WorkerContainer {
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
  const repoFactory = new DrizzleRepositoryFactory(db);
  const repositories = createWorkerRepositories(db);
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
  const reportWorkerJobFailure = createReportWorkerJobFailure(log);

  const heartbeatKeys = listWorkerHeartbeatKeys(queueRuntimeEnvFromWorkerEnv(env));
  async function heartbeat(queue: string) {
    await redis.set(`worker:heartbeat:${queue}`, String(Date.now()), "EX", 600);
  }

  const deps: WorkerBootstrapDeps = {
    env,
    db,
    redis,
    log,
    bullConnection,
    queueOpts,
    uploadStorage,
    malwareScanner,
    imageProcessor,
    publicUploadBase,
    repoFactory,
    uploadValidationRepo: repositories.uploadValidationRepo,
    emailOutboxRepo: repositories.emailOutboxRepo,
    payoutStatementRepo: repositories.payoutStatementRepo,
    profileMarketingReader: repositories.profileMarketingReader,
    marketingEventOutboxWorker: repositories.marketingEventOutboxWorker,
    dataExportRepo: repositories.dataExportRepo,
    newsletterSignupSyncRepo: repositories.newsletterSignupSyncRepo,
    sourceOfFundsDocumentPurgeRepo: repositories.sourceOfFundsDocumentPurgeRepo,
    marketingContactSyncRepo: repositories.marketingContactSyncRepo,
    staffOpsRecipientReader: repositories.staffOpsRecipientReader,
    complianceRecipientReader: repositories.complianceRecipientReader,
    sentryMonitorSlugs,
    heartbeat,
    reportWorkerJobFailure,
  };

  const webhookWorkers = registerWebhookWorker(deps);
  const mediaWorkers = registerMediaWorkers(deps);
  const emailWorkers = registerEmailWorker(deps);
  const marketingWorkers = registerMarketingWorkers(deps);
  const payoutWorkers = registerPayoutWorkers(deps);
  const complianceWorkers = registerComplianceWorkers(deps, {
    emailOutboxService: emailWorkers.emailOutboxService,
  });
  const purgeWorkers = registerPurgeWorkers(deps);
  const cronWorkers = registerCronWorkers(deps);

  registerWorkerErrorHandlers(
    [
      ...webhookWorkers.errorHandlers,
      ...mediaWorkers.errorHandlers,
      ...emailWorkers.errorHandlers,
      ...marketingWorkers.errorHandlers,
      ...payoutWorkers.errorHandlers,
      ...complianceWorkers.errorHandlers,
      ...purgeWorkers.errorHandlers,
      ...cronWorkers.errorHandlers,
    ],
    log,
  );

  const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, queueOpts(DEAD_LETTER_QUEUE_NAME));
  registerDlqHandlers(
    [
      ...emailWorkers.dlqHandlers,
      ...payoutWorkers.dlqHandlers,
      ...complianceWorkers.dlqHandlers,
      ...marketingWorkers.dlqHandlers,
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
          heartbeat("retry-xero-invoice-creation"),
          heartbeat("retry-refund-reconciles"),
          heartbeat("refresh-xero-tokens"),
          heartbeat("process-notification-outbox"),
          heartbeat("ensure-lot-invoices"),
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
    emailService: emailWorkers.emailOutboxService,
    supportContactEmail: env.EMAIL_REPLY_TO ?? "support@lax.bid",
    adminPayoutsUrl,
    adminEmailAddress,
    webOrigin: env.WEB_ORIGIN,
    staffOpsRecipientReader: repositories.staffOpsRecipientReader,
    complianceRecipientReader: repositories.complianceRecipientReader,
    ...(marketingWorkers.marketingContactSync
      ? {
          enqueueMarketingContactSync: async (data: {
            userId: string;
            reason: string;
            eventId: number;
          }) => {
            await marketingWorkers.marketingSyncQueue.add(
              "marketing-contact-sync",
              { userId: data.userId, reason: data.reason } satisfies MarketingContactSyncJobData,
              {
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
          ensureLotInvoice: async (lotId: string) =>
            postInternalCronJob({
              apiBaseUrl: env.API_INTERNAL_BASE_URL,
              cronSecret: internalCronSecret,
              path: "ensure-lot-invoice",
              body: { lotId },
              log,
            }),
        }
      : {}),
  });
  void projectorRunner.start();

  return {
    env,
    db,
    redis,
    log,
    deps,
    bootedAt,
    heartbeatKeys,
    marketingEventsOutcomeTotal,
    marketingEventsCapiBatchSize,
    webhookWorkers,
    mediaWorkers,
    emailWorkers,
    marketingWorkers,
    payoutWorkers,
    complianceWorkers,
    purgeWorkers,
    cronWorkers,
    deadLetterQueue,
    projectorRunner,
  };
}

export async function shutdownWorkerContainer(
  container: WorkerContainer,
  signal: NodeJS.Signals,
  closeServer: () => Promise<void>,
): Promise<void> {
  const { log, marketingWorkers, redis, db } = container;
  log.info({ signal }, "draining worker");
  const timeout = setTimeout(() => process.exit(1), 30_000);
  timeout.unref();
  await marketingWorkers
    .drainMarketingPipeline()
    .then(() =>
      Promise.allSettled([
        container.webhookWorkers.close(),
        container.mediaWorkers.close(),
        container.emailWorkers.close(),
        marketingWorkers.close(),
        container.payoutWorkers.close(),
        container.complianceWorkers.close(),
        container.purgeWorkers.close(),
        container.cronWorkers.close(),
        container.deadLetterQueue.close(),
        container.projectorRunner.stop(),
      ]),
    )
    .then(() => redis.quit())
    .then(() => closeDb(db))
    .finally(async () => {
      await closeServer();
      clearTimeout(timeout);
      process.exit(0);
    });
}
