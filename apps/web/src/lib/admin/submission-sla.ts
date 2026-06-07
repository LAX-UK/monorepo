import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionSlaTone = "default" | "amber" | "red";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days waiting in a staff queue stage (submitted, under review, or approved). */
export function submissionQueueSlaDays(
  status: ItemSubmissionStatus,
  updatedAt: Date,
  now = Date.now(),
): number | null {
  if (status !== "submitted" && status !== "under_review" && status !== "approved") {
    return null;
  }
  const elapsed = Math.max(0, now - updatedAt.getTime());
  return Math.floor(elapsed / MS_PER_DAY);
}

export function submissionSlaTone(days: number): SubmissionSlaTone {
  if (days > 7) return "red";
  if (days > 3) return "amber";
  return "default";
}

export function formatSubmissionSlaLabel(days: number): string {
  return days === 1 ? "1 day waiting" : `${days} days waiting`;
}
