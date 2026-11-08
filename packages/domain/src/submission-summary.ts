import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionStatusCounts = Record<ItemSubmissionStatus, number>;

/** A seller's submissions by status, with the two counts the workspace calls out. */
export type SubmissionSummary = {
  counts: SubmissionStatusCounts;
  total: number;
  /** Saved but not sent yet. */
  drafts: number;
  /** Sent back by staff: the seller must change something and send it again. */
  needsChanges: number;
};

function count(counts: Partial<SubmissionStatusCounts>, status: ItemSubmissionStatus): number {
  const n = counts[status];
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Builds the submissions summary from per-status counts; a missing status counts as zero. */
export function summariseSubmissionCounts(counts: SubmissionStatusCounts): SubmissionSummary {
  return {
    counts,
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    drafts: count(counts, "draft"),
    needsChanges: count(counts, "changes_requested"),
  };
}
