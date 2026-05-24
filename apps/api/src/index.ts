import { captureBackgroundError, initNodeSentry } from "@auction/observability";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { loadEnv } from "./env.js";
import type { LotJobScheduler } from "./jobs/lot-job-scheduler.js";

const env = loadEnv();
if (env.SENTRY_DSN_API) {
  initNodeSentry({
    dsn: env.SENTRY_DSN_API,
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1,
  });
}
const container = createContainer(env);
const app = createApp(container, env, container.authenticator);

function reportBackground(component: string, err: unknown, extra?: Record<string, unknown>): void {
  console.error(`[${component}]`, err);
  captureBackgroundError(component, err, extra ? { extra } : undefined);
}

// BullMQ / ioredis emit `error`; without a listener Node exits the process.
container.redis.on("error", (err: Error) => {
  reportBackground("redis", err);
});
const lotJobs = container.lotJobScheduler as LotJobScheduler;
lotJobs.queue.on("error", (err: Error) => {
  reportBackground("lot-queue", err);
});
const lotWorker = lotJobs.createWorker();
lotWorker.on("error", (err: Error) => {
  reportBackground("lot-worker", err);
});
lotWorker.on("failed", (job: { id?: string } | undefined, err: Error) => {
  reportBackground("lot-worker", err, { jobId: job?.id });
});

const LIFECYCLE_MS = 10_000;
setInterval(() => {
  void container.lotLifecycleService
    .runTransitions()
    .then(() => container.saleLifecycleService.reconcileSaleStatuses())
    .catch((err) => {
      reportBackground("lot-lifecycle", err);
    });
}, LIFECYCLE_MS);
void container.lotLifecycleService
  .runTransitions()
  .then(() => container.saleLifecycleService.reconcileSaleStatuses())
  .catch((err) => {
    reportBackground("lot-lifecycle:initial", err);
  });

const server = serve(
  {
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: env.PORT,
  },
  (info) => {
    console.log(`API listening on http://${info.address}:${info.port}`);
  },
);

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received; draining HTTP server`);
  const timeout = setTimeout(() => {
    console.error("[api] graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  timeout.unref();
  server.close((err) => {
    if (err) {
      console.error("[api] failed to close server", err);
      process.exit(1);
    }
    void Promise.allSettled([
      lotWorker.close(),
      container.uploadValidationQueue.close(),
      container.redis.quit(),
    ]).finally(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
