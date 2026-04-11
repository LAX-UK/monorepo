import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const container = createContainer(env);
const app = createApp(container, env, container.authenticator);

const LIFECYCLE_MS = 60_000;
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
    port: env.PORT,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
