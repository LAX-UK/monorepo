export const SHOP_PRODUCTION_TASK_STATUSES = [
  "queued",
  "printing",
  "qc_pending",
  "qc_failed",
  "qc_passed",
  "completed",
  "cancelled",
] as const;

export type ShopProductionTaskStatus = (typeof SHOP_PRODUCTION_TASK_STATUSES)[number];

/**
 * Where a task may go next. The first entry is the usual forward step; a failed quality check
 * goes back to printing because the edition is reprinted rather than abandoned. `completed` and
 * `cancelled` are final, so a mistaken cancellation means creating a new task.
 */
const NEXT_STEPS: Readonly<Record<ShopProductionTaskStatus, readonly ShopProductionTaskStatus[]>> =
  {
    queued: ["printing", "cancelled"],
    printing: ["qc_pending", "cancelled"],
    qc_pending: ["qc_passed", "qc_failed", "cancelled"],
    qc_failed: ["printing", "cancelled"],
    qc_passed: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

export function productionTaskNextSteps(
  from: ShopProductionTaskStatus,
): readonly ShopProductionTaskStatus[] {
  return NEXT_STEPS[from];
}

/** Staying in the same status is not a transition, so it is refused. */
export function canTransitionProductionTask(
  from: ShopProductionTaskStatus,
  to: ShopProductionTaskStatus,
): boolean {
  return NEXT_STEPS[from].includes(to);
}
