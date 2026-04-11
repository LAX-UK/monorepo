import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const container = createContainer(env);
const app = createApp(container, env, container.authenticator);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);
