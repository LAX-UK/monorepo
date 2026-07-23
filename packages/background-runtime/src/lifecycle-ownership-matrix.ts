import { BACKGROUND_OPERATION_REGISTRY } from "./registry.js";

export const LIFECYCLE_LOCAL_OPERATION_IDS = [
  "lot_lifecycle_tick",
  "lot_lifecycle_queue_activate",
  "lot_lifecycle_queue_end",
  "absentee_replay_lot",
] as const;

export function listLifecycleBackgroundOperationIds(): string[] {
  return BACKGROUND_OPERATION_REGISTRY.filter(
    (op) => op.kind === "lifecycle_tick" || op.kind === "lifecycle_queue",
  ).map((op) => op.id);
}

/** Fail CI when worker lifecycle handlers delegate to API except via named rollback adapters. */
export function assertWorkerLifecycleHandlersAreLocal(source: string): void {
  const forbidden = ["postInternalCronJob(", "apiRollbackCron("];
  for (const marker of forbidden) {
    if (source.includes(marker)) {
      throw new Error(
        `worker lifecycle handlers must execute locally (found forbidden ${marker.trim()}); see lifecycle-ownership-matrix`,
      );
    }
  }
}
