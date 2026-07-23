import type { QueueRuntimeEnv } from "@auction/queues";
import type { loadWorkerEnv } from "../env.js";
import { isMarketingEventsEnabled } from "./marketing-events-enabled.js";

type WorkerEnv = ReturnType<typeof loadWorkerEnv>;

export function queueRuntimeEnvFromWorkerEnv(env: WorkerEnv): QueueRuntimeEnv {
  return {
    appEnv: env.APP_ENV ?? "development",
    cronInternalSecret: env.CRON_INTERNAL_SECRET,
    marketingEventsEnabled: isMarketingEventsEnabled(env),
    lifecycleExecutionOwner: env.LIFECYCLE_EXECUTION_OWNER,
  };
}
