import { initNodeSentry } from "@auction/observability";
import { createShopApiApp } from "./app.js";
import { createShopApiContainer } from "./container.js";
import { createShopApiScheduler } from "./create-shop-api-scheduler.js";
import { loadShopApiEnv } from "./env.js";

const env = loadShopApiEnv();
if (env.SENTRY_DSN_SHOP_API) {
  initNodeSentry({
    dsn: env.SENTRY_DSN_SHOP_API,
    nodeEnv: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.05 : 1,
  });
}

const container = createShopApiContainer(env);
const app = createShopApiApp({ deps: container.app });
const scheduler = createShopApiScheduler({ db: container.db, env, log: app.log });

const shutdown = async () => {
  scheduler?.stop();
  await app.close();
  await container.close();
};

process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));

await app.listen({ port: env.PORT, host: "0.0.0.0" });
