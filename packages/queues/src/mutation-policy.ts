import { QUEUE_REGISTRY, type QueueName } from "./registry.js";

export type QueueMutationAction = "retry" | "pause" | "resume";

export type AppEnv = "production" | "test" | "development";

export function isQueueMutationAllowed(
  queueName: QueueName,
  action: QueueMutationAction,
  appEnv: AppEnv,
): boolean {
  const def = QUEUE_REGISTRY[queueName];
  if (action === "retry") {
    return def.allowUiRetries && appEnv !== "production";
  }
  if (action === "pause" || action === "resume") {
    if (def.pauseOrder === null) return false;
    if (appEnv === "production" && def.criticality === "high") return false;
    return true;
  }
  return false;
}

export function assertQueueMutationAllowed(
  queueName: QueueName,
  action: QueueMutationAction,
  appEnv: AppEnv,
): void {
  if (isQueueMutationAllowed(queueName, action, appEnv)) return;
  const def = QUEUE_REGISTRY[queueName];
  if (action === "retry") {
    throw new Error("retries_disabled");
  }
  if (def.pauseOrder === null) {
    throw new Error("pause_not_allowed");
  }
  throw new Error("mutations_disabled_in_prod");
}

export function bullBoardReadOnlyInProd(queueName: QueueName, appEnv: AppEnv): boolean {
  return appEnv === "production" && QUEUE_REGISTRY[queueName].criticality === "high";
}

/** Whether Bull Board should allow retries for this queue in the current environment. */
export function bullBoardAllowRetries(queueName: QueueName, appEnv: AppEnv): boolean {
  return QUEUE_REGISTRY[queueName].allowUiRetries && appEnv !== "production";
}
