import { createDb } from "@auction/db";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { Queue, Worker } from "bullmq";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { Redis } from "ioredis";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { loadWorkerEnv } from "./env.js";
import { retireExpiredJwksKeys } from "./jobs/jwks-rotation.js";
import { gcPendingUploads, validateUploadJob } from "./jobs/validate-upload.js";
import { createUploadStorage } from "./lib/upload-storage.js";
import { createProjectorRunner } from "./projectors/runner.js";

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
const bootedAt = Date.now();

const heartbeatKeys = [
  "worker:heartbeat:webhook-events",
  "worker:heartbeat:domain-events",
  "worker:heartbeat:validate-upload",
  "worker:heartbeat:gc-pending-uploads",
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
void Promise.all([
  heartbeat("webhook-events"),
  heartbeat("validate-upload"),
  heartbeat("gc-pending-uploads"),
]);

const projectorRunner = createProjectorRunner({
  db,
  log,
  heartbeat: () => heartbeat("domain-events"),
});
void projectorRunner.start();

const jwksRotationInterval = setInterval(
  () => {
    void retireExpiredJwksKeys(db).catch((err) => {
      log.error({ err }, "JWKS retirement job failed");
    });
  },
  15 * 60 * 1000,
);
jwksRotationInterval.unref();

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
    gcPendingUploadsWorker.close(),
    gcUploadQueue.close(),
    projectorRunner.stop(),
    Promise.resolve().then(() => clearInterval(jwksRotationInterval)),
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
