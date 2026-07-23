import { runWithRenewableLease } from "@auction/background-runtime";
import type { Redis } from "ioredis";
import type { WorkerEnv } from "../env.js";
import {
  type CreateWorkerLifecycleExecutorInput,
  type WorkerLifecycleExecutor,
  createWorkerLifecycleExecutor,
} from "./create-worker-lifecycle-executor.js";

export type { WorkerLifecycleExecutor, CreateWorkerLifecycleExecutorInput };
export { createWorkerLifecycleExecutor };

export function assertLifecycleExecutionOwner(
  env: Pick<WorkerEnv, "LIFECYCLE_EXECUTION_OWNER">,
): void {
  if (env.LIFECYCLE_EXECUTION_OWNER !== "api" && env.LIFECYCLE_EXECUTION_OWNER !== "worker") {
    throw new Error("invalid LIFECYCLE_EXECUTION_OWNER");
  }
}

export const LOT_LIFECYCLE_TICK_LOCK_KEY = "lot:lifecycle:tick:lock";
const LOT_LIFECYCLE_TICK_LOCK_TTL_MS = 15_000;

export type WorkerLifecycleTickOutcome =
  | { ok: true }
  | { ok: false; reason: "lifecycle_tick_already_running" | "lifecycle_tick_lock_failed" };

export async function runWorkerOwnedLifecycleTick(opts: {
  redis: Redis;
  executor: WorkerLifecycleExecutor;
}): Promise<WorkerLifecycleTickOutcome> {
  const locked = await runWithRenewableLease(
    opts.redis,
    LOT_LIFECYCLE_TICK_LOCK_KEY,
    LOT_LIFECYCLE_TICK_LOCK_TTL_MS,
    async () => {
      await opts.executor.lotLifecycleService.runTransitions();
      await opts.executor.saleLifecycleService.reconcileSaleStatuses();
    },
  );
  if (!locked.ok) {
    if (locked.reason === "lock_failed") {
      return { ok: false, reason: "lifecycle_tick_lock_failed" };
    }
    return { ok: false, reason: "lifecycle_tick_already_running" };
  }
  return { ok: true };
}
