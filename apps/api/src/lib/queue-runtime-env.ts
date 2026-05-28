import type { QueueRuntimeEnv } from "@auction/queues";
import type { Env } from "../env.js";
import { isMarketingEventsEnabled } from "./marketing-events-enabled.js";

export function queueRuntimeEnvFromApiEnv(env: Env): QueueRuntimeEnv {
  return {
    appEnv: env.APP_ENV,
    cronInternalSecret: env.CRON_INTERNAL_SECRET,
    marketingEventsEnabled: isMarketingEventsEnabled(env),
  };
}
