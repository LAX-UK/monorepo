import { DrizzleRepositoryFactory } from "@auction/api/exports/repository-factory";
import { closeDb, createDb } from "@auction/db";
import { getBullMqTelemetry, initNodeSentry } from "@auction/observability";
import {
  DEAD_LETTER_QUEUE_NAME,
  QUEUE_REGISTRY,
  type QueueName,
  createBullQueueOptions,
  listWorkerHeartbeatKeys,
  registerDlqHandlers,
} from "@auction/queues";
import { serve } from "@hono/node-server";
import { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { Redis } from "ioredis";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { loadWorkerEnv } from "./env.js";
import type { MarketingContactSyncJobData } from "./jobs/marketing-contact-sync.js";
import { marketingEventsOutcomeTotal } from "./jobs/marketing-event-processor.js";
import { postInternalCronJob } from "./jobs/post-internal-cron-job.js";
import {
  ClamAvHttpMalwareScanner,
  ClamAvMalwareScanner,
  NoOpMalwareScanner,
} from "./lib/malware-scanner.js";
import { isMarketingEventsEnabled } from "./lib/marketing-events-enabled.js";
import { queueRuntimeEnvFromWorkerEnv } from "./lib/queue-runtime-env.js";
import { loadSentryMonitorSlugs } from "./lib/sentry-cron.js";
import { SharpImageProcessor } from "./lib/sharp-image-processor.js";
import { createUploadStorage } from "./lib/upload-storage.js";
import { marketingEventsCapiBatchSize } from "./marketing/meta-capi-batch-collector.js";
import { createProjectorRunner } from "./projectors/runner.js";
import { syncXeroPayoutBillViaApi } from "./projectors/xero-payout-bill-sync.js";
import { registerComplianceWorkers } from "./workers/register-compliance-workers.js";
import { registerCronWorkers } from "./workers/register-cron-workers.js";
import { registerEmailWorker } from "./workers/register-email-worker.js";
import { registerMarketingWorkers } from "./workers/register-marketing-workers.js";
import { registerMediaWorkers } from "./workers/register-media-workers.js";
import { registerPayoutWorkers } from "./workers/register-payout-workers.js";
import { registerPurgeWorkers } from "./workers/register-purge-workers.js";
import { registerWebhookWorker } from "./workers/register-webhook-worker.js";
import type { WorkerBootstrapDeps } from "./workers/types.js";
import {
  createReportWorkerJobFailure,
  registerWorkerErrorHandlers,
} from "./workers/worker-utils.js";

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

function shutdown(signal: NodeJS.Signals) {
  log.info({ signal }, "draining worker");
  const timeout = setTimeout(() => process.exit(1), 30_000);
  timeout.unref();
  void marketingWorkers
    .drainMarketingPipeline()
    .then(() =>
      Promise.allSettled([
        webhookWorkers.close(),
        mediaWorkers.close(),
        emailWorkers.close(),
        marketingWorkers.close(),
        payoutWorkers.close(),
        complianceWorkers.close(),
        purgeWorkers.close(),
        cronWorkers.close(),
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
