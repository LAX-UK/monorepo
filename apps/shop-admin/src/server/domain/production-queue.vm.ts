import {
  type AdminProductionTaskHistoryEntry,
  PRODUCTION_TASK_STATUSES,
  type ProductionTaskStaff,
  type ProductionTaskStatus,
} from "@auction/shop-contracts";
import { productionTaskNextSteps } from "@auction/shop-domain";
import { enquiryStaffName } from "./enquiry-inbox.vm";
import { staffStatusLabel } from "./staff-status";

export const PRODUCTION_LIST_PATH = "/production";

export { PRODUCTION_TASK_STATUSES };

export type ProductionAssigneeFilter = "me" | "unassigned";

export const PRODUCTION_STATUS_LABELS = Object.fromEntries(
  PRODUCTION_TASK_STATUSES.map((status) => [status, staffStatusLabel("production", status)]),
) as Record<ProductionTaskStatus, string>;

export const PRODUCTION_ASSIGNEE_LABELS: Record<ProductionAssigneeFilter, string> = {
  me: "Me",
  unassigned: "Unassigned",
};

const STEP_LABELS: Record<ProductionTaskStatus, string> = {
  queued: "Return to queue",
  printing: "Start printing",
  qc_pending: "Send for quality check",
  qc_failed: "Fail quality check",
  qc_passed: "Pass quality check",
  completed: "Mark complete",
  cancelled: "Cancel task",
};

export type ProductionStep = { to: ProductionTaskStatus; label: string };

export type ProductionTaskSteps = {
  /** Moves that carry the work on, the usual one first. */
  forward: ProductionStep[];
  /** Cancelling is the one move that cannot be undone, so it is kept apart and confirmed. */
  cancel: ProductionStep | null;
};

/** The moves open to a task, labelled for the button that makes each one. */
export function productionTaskSteps(status: ProductionTaskStatus): ProductionTaskSteps {
  const steps = productionTaskNextSteps(status).map((to) => ({
    to,
    // After a failed check the same move is a second print, not a first.
    label: status === "qc_failed" && to === "printing" ? "Reprint" : STEP_LABELS[to],
  }));
  return {
    forward: steps.filter((step) => step.to !== "cancelled"),
    cancel: steps.find((step) => step.to === "cancelled") ?? null,
  };
}

/** Who a task belongs to, for display; a task nobody holds is "Unassigned". */
export function productionAssigneeName(assignee: ProductionTaskStaff | null): string {
  return assignee ? enquiryStaffName(assignee) : "Unassigned";
}

/** A task is known by its artwork and edition; the id is the fallback if the artwork is gone. */
export function productionTaskTitle(task: {
  artworkTitle: string | null;
  editionNumber: number | null;
  taskId: string;
}): string {
  if (!task.artworkTitle) return `Task ${task.taskId.slice(0, 8)}`;
  return task.editionNumber === null
    ? task.artworkTitle
    : `${task.artworkTitle} (edition ${task.editionNumber})`;
}

/** One line of the task's history, such as "Moved from Queued to Printing". */
export function productionHistorySummary(entry: AdminProductionTaskHistoryEntry): string {
  if (entry.kind === "created") return "Task created";
  const parts: string[] = [];
  if (entry.status) {
    parts.push(
      `Moved from ${PRODUCTION_STATUS_LABELS[entry.status.from]} to ${PRODUCTION_STATUS_LABELS[entry.status.to]}`,
    );
  }
  if (entry.assignee) {
    parts.push(
      entry.assignee.to ? `Assigned to ${productionAssigneeName(entry.assignee.to)}` : "Unassigned",
    );
  }
  return parts.join(". ") || "Updated";
}
