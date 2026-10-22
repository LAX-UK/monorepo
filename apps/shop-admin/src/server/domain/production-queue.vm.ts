import {
  type AdminProductionTaskHistoryEntry,
  PRODUCTION_TASK_STATUSES,
  type ProductionTaskStaff,
  type ProductionTaskStatus,
} from "@auction/shop-contracts";
import { productionTaskNextSteps } from "@auction/shop-domain";
import { enquiryStaffName } from "./enquiry-inbox.vm";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

export const PRODUCTION_LIST_PATH = "/production";

export { PRODUCTION_TASK_STATUSES };

export type ProductionAssigneeFilter = "me" | "unassigned";

/** The queue's filter state, as it appears in the page URL. Every field is optional. */
export type ProductionQueueQuery = {
  q?: string;
  status?: ProductionTaskStatus;
  assignee?: ProductionAssigneeFilter;
  cursor?: string;
};

export const PRODUCTION_STATUS_LABELS: Record<ProductionTaskStatus, string> = {
  queued: "Queued",
  printing: "Printing",
  qc_pending: "Awaiting quality check",
  qc_failed: "Quality check failed",
  qc_passed: "Quality check passed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PRODUCTION_ASSIGNEE_LABELS: Record<ProductionAssigneeFilter, string> = {
  me: "Me",
  unassigned: "Unassigned",
};

export type ProductionBadgeTone = "info" | "success" | "danger" | "neutral";

export function productionStatusTone(status: ProductionTaskStatus): ProductionBadgeTone {
  switch (status) {
    case "queued":
    case "cancelled":
      return "neutral";
    case "printing":
    case "qc_pending":
      return "info";
    case "qc_failed":
      return "danger";
    case "qc_passed":
    case "completed":
      return "success";
  }
}

/** Reads the URL, dropping anything unrecognised so a hand-edited link still opens the queue. */
export function parseProductionQueueQuery(params: RawSearchParams): ProductionQueueQuery {
  const q = singleParam(params.q);
  const status = oneOf(singleParam(params.status), PRODUCTION_TASK_STATUSES);
  const assignee = oneOf(singleParam(params.assignee), ["me", "unassigned"] as const);
  const cursor = singleParam(params.cursor);
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(assignee ? { assignee } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/** True when any filter narrows the list; paging does not count. */
export function hasActiveProductionFilters(query: ProductionQueueQuery): boolean {
  return Boolean(query.q || query.status || query.assignee);
}

/**
 * The queue URL for `query` with `change` applied. Changing a filter returns to the first page,
 * because a cursor only means something under the filters it was issued for. A `null` clears a field.
 */
export function productionQueueHref(
  query: ProductionQueueQuery,
  change: { [K in keyof ProductionQueueQuery]?: ProductionQueueQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = { ...query, cursor: undefined };
  for (const [key, value] of Object.entries(change)) next[key] = value ?? undefined;
  return listHref(PRODUCTION_LIST_PATH, next);
}

/** The same URL but one page further on. */
export function productionQueuePageHref(query: ProductionQueueQuery, cursor: string): string {
  return listHref(PRODUCTION_LIST_PATH, { ...query, cursor });
}

/** The query parameters the tasks API expects for this URL state. */
export function productionQueueApiQuery(query: ProductionQueueQuery): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => Boolean(value)));
}

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
