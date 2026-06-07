import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";

/** Merge row statuses into a map so cross-page selections retain known statuses. */
export function mergeSubmissionStatuses(
  current: ReadonlyMap<string, string>,
  rows: Pick<AdminSubmissionTableRow, "id" | "status" | "blocksAccept">[],
): Map<string, string> {
  const next = new Map(current);
  for (const row of rows) {
    next.set(row.id, row.status);
  }
  return next;
}

export function mergeSubmissionBlocksAccept(
  current: ReadonlyMap<string, boolean>,
  rows: Pick<AdminSubmissionTableRow, "id" | "blocksAccept">[],
): Map<string, boolean> {
  const next = new Map(current);
  for (const row of rows) {
    next.set(row.id, row.blocksAccept);
  }
  return next;
}

/** True when every selected id is known and under review (safe for bulk approve/reject). */
export function areSubmissionBulkIdsActionable(
  selectedIds: readonly string[],
  statusById: ReadonlyMap<string, string>,
  blocksAcceptById: ReadonlyMap<string, boolean>,
): boolean {
  if (selectedIds.length === 0) return false;
  return selectedIds.every(
    (id) => statusById.get(id) === "under_review" && !blocksAcceptById.get(id),
  );
}
