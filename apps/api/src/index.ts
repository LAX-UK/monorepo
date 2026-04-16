import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const container = createContainer(env);
const app = createApp(container, env, container.authenticator);

// BullMQ / ioredis emit `error`; without a listener Node exits the process.
container.redis.on("error", (err: Error) => {
  console.error("[redis]", err);
});
container.auctionJobScheduler.queue.on("error", (err: Error) => {
  console.error("[auction-queue]", err);
});
const auctionWorker = container.auctionJobScheduler.createWorker();
auctionWorker.on("error", (err: Error) => {
  console.error("[auction-worker]", err);
});
auctionWorker.on("failed", (job: { id?: string } | undefined, err: Error) => {
  console.error("[auction-worker] job failed", job?.id, err);
});

const LIFECYCLE_MS = 10_000;
setInterval(() => {
  void container.auctionLifecycleService.runTransitions().catch((err) => {
    console.error("[auction-lifecycle]", err);
  });
}, LIFECYCLE_MS);
void container.auctionLifecycleService.runTransitions().catch((err) => {
  console.error("[auction-lifecycle:initial]", err);
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
