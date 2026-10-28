import type { ItemSubmissionStatus, LotStatus } from "@auction/types";

/**
 * How far a consignment has got, as an organisation follows it on Home: the six stages a work
 * passes through between being sent to LAX and its sale. Drafts and closed work (rejected,
 * withdrawn, cancelled) are not progress and belong to none of them.
 */
export const CONSIGNMENT_PROGRESS_STAGES = [
  "under_review",
  "needs_changes",
  "accepted",
  "in_sale",
  "sold",
  "unsold",
] as const;

export type ConsignmentProgressStage = (typeof CONSIGNMENT_PROGRESS_STAGES)[number];

export type ConsignmentProgressCounts = Record<ConsignmentProgressStage, number>;

/** Submission statuses before a lot exists; a converted submission waits for its catalogue. */
const SUBMISSION_STAGE: Record<ItemSubmissionStatus, ConsignmentProgressStage | null> = {
  draft: null,
  submitted: "under_review",
  under_review: "under_review",
  changes_requested: "needs_changes",
  approved: "accepted",
  converted: "accepted",
  rejected: null,
  withdrawn: null,
};

/** Lot statuses once the work is catalogued; an ended lot is sold or unsold by its winner. */
const LOT_STAGE: Record<LotStatus, (sold: boolean) => ConsignmentProgressStage | null> = {
  draft: () => "accepted",
  scheduled: () => "in_sale",
  active: () => "in_sale",
  ended: (sold) => (sold ? "sold" : "unsold"),
  cancelled: () => null,
  voided: () => null,
};

/** The stage of a submission that has no lot yet, or `null` when it is not in progress. */
export function submissionProgressStage(
  status: ItemSubmissionStatus,
): ConsignmentProgressStage | null {
  return SUBMISSION_STAGE[status];
}

/** The stage of a catalogued work, or `null` when it is not in progress. */
export function lotProgressStage(lot: {
  status: LotStatus;
  sold: boolean;
}): ConsignmentProgressStage | null {
  return LOT_STAGE[lot.status](lot.sold);
}

/** Submissions (without a lot) counted by status, and lots counted by status and outcome. */
export type ConsignmentProgressRows = {
  submissions: ReadonlyArray<{ status: ItemSubmissionStatus; count: number }>;
  lots: ReadonlyArray<{ status: LotStatus; sold: boolean; count: number }>;
};

export function emptyConsignmentProgress(): ConsignmentProgressCounts {
  return { under_review: 0, needs_changes: 0, accepted: 0, in_sale: 0, sold: 0, unsold: 0 };
}

/** Counts per stage. Each work is counted once: by its lot once it has one. */
export function consignmentProgressCounts(
  rows: ConsignmentProgressRows,
): ConsignmentProgressCounts {
  const counts = emptyConsignmentProgress();
  for (const row of rows.submissions) {
    const stage = submissionProgressStage(row.status);
    if (stage) counts[stage] += row.count;
  }
  for (const row of rows.lots) {
    const stage = lotProgressStage(row);
    if (stage) counts[stage] += row.count;
  }
  return counts;
}

/** Works in progress across every stage. */
export function consignmentsInProgress(counts: ConsignmentProgressCounts): number {
  return CONSIGNMENT_PROGRESS_STAGES.reduce((total, stage) => total + counts[stage], 0);
}
