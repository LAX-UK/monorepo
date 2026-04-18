import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { loadEnv } from "./env.js";
import type { LotJobScheduler } from "./jobs/lot-job-scheduler.js";

const env = loadEnv();
const container = createContainer(env);
const app = createApp(container, env, container.authenticator);

// BullMQ / ioredis emit `error`; without a listener Node exits the process.
container.redis.on("error", (err: Error) => {
  console.error("[redis]", err);
});
const lotJobs = container.lotJobScheduler as LotJobScheduler;
lotJobs.queue.on("error", (err: Error) => {
  console.error("[lot-queue]", err);
});
const lotWorker = lotJobs.createWorker();
lotWorker.on("error", (err: Error) => {
  console.error("[lot-worker]", err);
});
lotWorker.on("failed", (job: { id?: string } | undefined, err: Error) => {
  console.error("[lot-worker] job failed", job?.id, err);
});

const LIFECYCLE_MS = 10_000;
setInterval(() => {
  void container.lotLifecycleService
    .runTransitions()
    .then(() => container.saleLifecycleService.reconcileSaleStatuses())
    .catch((err) => {
      console.error("[lot-lifecycle]", err);
    });
}, LIFECYCLE_MS);
void container.lotLifecycleService
  .runTransitions()
  .then(() => container.saleLifecycleService.reconcileSaleStatuses())
  .catch((err) => {
    console.error("[lot-lifecycle:initial]", err);
  });

serve(
  {
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: env.PORT,
  },
  (info) => {
    console.log(`API listening on http://${info.address}:${info.port}`);
  },
);
