import type { Redis } from "ioredis";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import type { WorkerLifecycleExecutor } from "../lifecycle/worker-lifecycle-executor.js";
import { runWorkerOwnedLifecycleTick } from "../lifecycle/worker-lifecycle-executor.js";
import { postInternalCronJob } from "./post-internal-cron-job.js";

export async function runLotLifecycleTickJob(opts: {
  env: WorkerEnv;
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
  redis?: Redis;
  executor?: WorkerLifecycleExecutor;
}): Promise<void> {
  if (opts.env.LIFECYCLE_EXECUTION_OWNER === "worker") {
    if (!opts.redis || !opts.executor) {
      throw new Error("worker_lifecycle_tick_missing_redis_or_executor");
    }
    const outcome = await runWorkerOwnedLifecycleTick({
      redis: opts.redis,
      executor: opts.executor,
    });
    if (!outcome.ok && outcome.reason !== "lifecycle_tick_already_running") {
      opts.log.warn({ outcome }, "worker lifecycle tick deferred");
    }
    return;
  }

  await postInternalCronJob({
    apiBaseUrl: opts.apiBaseUrl,
    cronSecret: opts.cronSecret,
    log: opts.log,
    path: "lot-lifecycle-tick",
    treat409AsSuccess: true,
  });
}
