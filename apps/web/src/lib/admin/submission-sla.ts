import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionSlaTone = "default" | "amber" | "red";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Who a submission in each status is waiting on, or `null` when it waits on no one: drafts are
 * the seller's own, and converted, rejected and withdrawn work is finished. Only waiting work
 * shows a wait time.
 */
const WAITING_ON: Record<ItemSubmissionStatus, "specialist" | "seller_or_staff" | null> = {
  draft: null,
  submitted: "specialist",
  under_review: "specialist",
  approved: "seller_or_staff",
  changes_requested: null,
  rejected: null,
  withdrawn: null,
  converted: null,
};

/** Whether the submission is waiting on someone. Work that already has a lot is finished. */
export function submissionIsWaiting(input: {
  status: ItemSubmissionStatus;
  convertedLotId?: string | null | undefined;
}): boolean {
  if (input.convertedLotId) return false;
  return WAITING_ON[input.status] !== null;
}

/** Days waiting in a staff queue stage (submitted, under review, or accepted without a lot). */
export function submissionQueueSlaDays(
  status: ItemSubmissionStatus,
  updatedAt: Date,
  now = Date.now(),
  convertedLotId: string | null = null,
): number | null {
  if (!submissionIsWaiting({ status, convertedLotId })) return null;
  const elapsed = Math.max(0, now - updatedAt.getTime());
  return Math.floor(elapsed / MS_PER_DAY);
}

export function submissionSlaTone(days: number): SubmissionSlaTone {
  if (days > 7) return "red";
  if (days > 3) return "amber";
  return "default";
}

export function formatSubmissionSlaLabel(days: number): string {
  if (days === 0) return "Under a day";
  return days === 1 ? "1 day waiting" : `${days} days waiting`;
}
