import { createDb } from "@auction/db";
import { ConsoleEmailService, PostmarkEmailService, type IEmailService } from "@auction/email";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { Queue, Worker } from "bullmq";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { Redis } from "ioredis";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { loadWorkerEnv } from "./env.js";
import { ConsoleEmailSender, PostmarkEmailSender } from "./infrastructure/postmark-email.sender.js";
import { runBulkPayoutSettlementJob } from "./jobs/bulk-payout-settlement.js";
import { cleanupImageJob } from "./jobs/image-cleanup.js";
import {
  type SendEmailJobData,
  enqueueStaleEmailOutboxRows,
  sendEmailJob,
} from "./jobs/send-email.js";
import { gcPendingUploads, validateUploadJob } from "./jobs/validate-upload.js";
import { type ZohoCampaignsSyncJobData, zohoCampaignsSyncJob } from "./jobs/zoho-campaigns-sync.js";
import { createUploadStorage } from "./lib/upload-storage.js";
import { createProjectorRunner } from "./projectors/runner.js";
import { syncXeroPayoutBillViaApi } from "./projectors/xero-payout-bill-sync.js";
import { generatePayoutStatementJob } from "./jobs/generate-payout-statement.js";
import { runImpersonationSweeperJob } from "./jobs/impersonation-sweeper.js";
import { runLegalEntityArchiveCascadeJob } from "./jobs/legal-entity-archive-cascade.js";

const env = loadWorkerEnv();
if (env.SENTRY_DSN_WORKER) {
  Sentry.init({
    dsn: env.SENTRY_DSN_WORKER,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.05 : 1,
  });
}

const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "auction-worker", env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});
const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const uploadStorage = createUploadStorage(env);
const publicUploadBase =
  env.STORAGE_DRIVER === "s3" && env.S3_BUCKET && env.S3_REGION
    ? (env.S3_PUBLIC_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`)
    : undefined;
const bootedAt = Date.now();

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

const heartbeatKeys = [
  "worker:heartbeat:webhook-events",
  "worker:heartbeat:domain-events",
  "worker:heartbeat:validate-upload",
  "worker:heartbeat:image-cleanup",
  "worker:heartbeat:gc-pending-uploads",
  "worker:heartbeat:email",
  "worker:heartbeat:marketing-sync",
  "worker:heartbeat:payout-statements",
  ...(env.CRON_INTERNAL_SECRET ? ["worker:heartbeat:payout-settlement"] : []),
  "worker:heartbeat:legal-entity-archive",
  "worker:heartbeat:impersonation-sweeper",
];
async function heartbeat(queue: string) {
  await redis.set(`worker:heartbeat:${queue}`, String(Date.now()), "EX", 600);
}

const webhookWorker = new Worker(
  "webhook-events",
  async (job) => {
    log.info({ jobId: job.id, name: job.name }, "processed webhook job");
    await heartbeat("webhook-events");
  },
  { connection: redis },
);
webhookWorker.on("completed", () => void heartbeat("webhook-events"));

const validateUploadWorker = new Worker(
  "validate-upload",
  async (job) => {
    const uploadId = String((job.data as { uploadId?: unknown }).uploadId ?? "");
    if (!uploadId) {
      throw new Error("validate-upload job is missing uploadId");
    }
    await validateUploadJob({ db, storage: uploadStorage, uploadId, log });
    await heartbeat("validate-upload");
  },
  { connection: redis },
);
validateUploadWorker.on("completed", () => void heartbeat("validate-upload"));

const imageCleanupWorker = new Worker(
  "image-cleanup",
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
  { connection: redis },
);
imageCleanupWorker.on("completed", () => void heartbeat("image-cleanup"));

const gcUploadQueue = new Queue("gc-pending-uploads", { connection: redis });
const gcPendingUploadsWorker = new Worker(
  "gc-pending-uploads",
  async () => {
    await gcPendingUploads({ db, storage: uploadStorage, log });
    await heartbeat("gc-pending-uploads");
  },
  { connection: redis },
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
const emailQueue = new Queue<EmailQueueJobData>("email", { connection: redis });

const emailOutboxService: IEmailService =
  env.EMAIL_PROVIDER === "postmark"
    ? new PostmarkEmailService(db, emailQueue as Queue<{ outboxId: string }>)
    : new ConsoleEmailService(db, emailQueue as Queue<{ outboxId: string }>);
const emailWorker = new Worker<EmailQueueJobData>(
  "email",
  async (job) => {
    if (job.name === "outbox-drain") {
      const count = await enqueueStaleEmailOutboxRows({ db, queue: emailQueue });
      log.info({ count }, "email outbox drain completed");
      await heartbeat("email");
      return;
    }
    await sendEmailJob({ db, sender: emailSender, log }, job.data as SendEmailJobData);
    await heartbeat("email");
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: { max: 50, duration: 1000 },
  },
);
emailWorker.on("completed", () => void heartbeat("email"));
void emailQueue.add(
  "outbox-drain",
  {},
  { jobId: "email-outbox-drain", repeat: { every: 60_000 }, removeOnComplete: 100 },
);

const marketingSyncQueue = new Queue<ZohoCampaignsSyncJobData>("marketing-sync", {
  connection: redis,
});
const marketingSyncWorker = new Worker<ZohoCampaignsSyncJobData>(
  "marketing-sync",
  async (job) => {
    if (job.name === "zoho-campaigns-sync") {
      await zohoCampaignsSyncJob({ db, env, log, data: job.data });
    } else {
      log.warn({ jobId: job.id, name: job.name }, "unknown marketing-sync job");
    }
    await heartbeat("marketing-sync");
  },
  { connection: redis, concurrency: 3, limiter: { max: 10, duration: 1000 } },
);
marketingSyncWorker.on("completed", () => void heartbeat("marketing-sync"));

type PayoutStatementJobData = import("./jobs/generate-payout-statement.js").GeneratePayoutStatementJobData;
const payoutStatementQueue = new Queue<PayoutStatementJobData>("payout-statements", {
  connection: redis,
});
const payoutStatementWorker = new Worker<PayoutStatementJobData>(
  "payout-statements",
  async (job) => {
    await generatePayoutStatementJob({ db, storage: uploadStorage, env, log, job });
    await heartbeat("payout-statements");
  },
  {
    connection: redis,
    concurrency: 2,
    limiter: { max: 20, duration: 1000 },
  },
);
payoutStatementWorker.on("completed", () => void heartbeat("payout-statements"));

type LegalEntityArchiveJobData = { legalEntityId: string };
const legalEntityArchiveQueue = new Queue<LegalEntityArchiveJobData>("legal-entity-archive", {
  connection: redis,
});
const legalEntityArchiveWorker = new Worker<LegalEntityArchiveJobData>(
  "legal-entity-archive",
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
  { connection: redis },
);
legalEntityArchiveWorker.on("completed", () => void heartbeat("legal-entity-archive"));

const impersonationSweeperQueue = new Queue("impersonation-sweeper", { connection: redis });
const impersonationSweeperWorker = new Worker(
  "impersonation-sweeper",
  async () => {
    await runImpersonationSweeperJob({ db, log });
    await heartbeat("impersonation-sweeper");
  },
  { connection: redis },
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

let payoutSettlementQueue: Queue | undefined;
let payoutSettlementWorker: Worker | undefined;
if (env.CRON_INTERNAL_SECRET) {
  const cronSecret = env.CRON_INTERNAL_SECRET;
  payoutSettlementQueue = new Queue("payout-settlement", { connection: redis });
  payoutSettlementWorker = new Worker(
    "payout-settlement",
    async () => {
      await runBulkPayoutSettlementJob({
        apiBaseUrl: env.API_INTERNAL_BASE_URL,
        cronSecret,
        log,
      });
      await heartbeat("payout-settlement");
    },
    { connection: redis },
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

void Promise.all([
  heartbeat("webhook-events"),
  heartbeat("validate-upload"),
  heartbeat("image-cleanup"),
  heartbeat("gc-pending-uploads"),
  heartbeat("email"),
  heartbeat("marketing-sync"),
  heartbeat("payout-statements"),
  heartbeat("legal-entity-archive"),
  heartbeat("impersonation-sweeper"),
  ...(env.CRON_INTERNAL_SECRET ? [heartbeat("payout-settlement")] : []),
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
  void Promise.allSettled([
    webhookWorker.close(),
    validateUploadWorker.close(),
    imageCleanupWorker.close(),
    gcPendingUploadsWorker.close(),
    gcUploadQueue.close(),
    emailWorker.close(),
    emailQueue.close(),
    marketingSyncWorker.close(),
    marketingSyncQueue.close(),
    payoutStatementWorker.close(),
    payoutStatementQueue.close(),
    legalEntityArchiveWorker.close(),
    legalEntityArchiveQueue.close(),
    impersonationSweeperWorker.close(),
    impersonationSweeperQueue.close(),
    ...(payoutSettlementWorker ? [payoutSettlementWorker.close()] : []),
    ...(payoutSettlementQueue ? [payoutSettlementQueue.close()] : []),
    projectorRunner.stop(),
    redis.quit(),
  ]).finally(() => {
    server.close(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
