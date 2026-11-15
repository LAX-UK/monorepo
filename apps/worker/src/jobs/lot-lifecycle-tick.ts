import type { Redis } from "ioredis";
import type pino from "pino";
import type { WorkerEnv } from "../env.js";
import type { WorkerLifecycleExecutor } from "../lifecycle/worker-lifecycle-executor.js";
import { runWorkerOwnedLifecycleTick } from "../lifecycle/worker-lifecycle-executor.js";
import { TransientCronError, postInternalCronJob } from "./post-internal-cron-job.js";

/** Transient failures lasting longer than this are a real outage and reported as errors. */
export const LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS = 120_000;

/** Start of the current run of consecutive transient failures, or null when healthy. */
let transientSince: number | null = null;

export function resetLifecycleTickTransientState(): void {
  transientSince = null;
}

export async function runLotLifecycleTickJob(opts: {
  env: WorkerEnv;
  apiBaseUrl: string;
  cronSecret: string;
  log: pino.Logger;
  redis?: Redis;
  executor?: WorkerLifecycleExecutor;
  /** Replaceable in tests. */
  now?: () => number;
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

  // No gateway retry: the tick is safe to repeat, but it runs every 10 seconds on a single
  // worker, so waiting 15 seconds to ask again would hold back the next ticks and delay lots
  // ending. The next tick is the retry.
  try {
    await postInternalCronJob({
      apiBaseUrl: opts.apiBaseUrl,
      cronSecret: opts.cronSecret,
      log: opts.log,
      path: "lot-lifecycle-tick",
      treat409AsSuccess: true,
      transientAsWarning: true,
    });
    transientSince = null;
  } catch (err) {
    if (!(err instanceof TransientCronError)) throw err;
    const now = (opts.now ?? Date.now)();
    transientSince ??= now;
    const failingForMs = now - transientSince;
    if (failingForMs > LIFECYCLE_TICK_TRANSIENT_ESCALATE_MS) {
      // Not a rollout blip any more: surface it as a real failure.
      opts.log.error({ failingForMs }, "lot-lifecycle-tick API unreachable for too long");
      throw err;
    }
    // Swallowed on purpose: the next tick is the retry, so no failed job and no Sentry error.
  }
}
