import type { ManualReviewReason } from "@auction/types";
import { MANUAL_REVIEW_REASON_LABELS } from "./manual-review-reason.copy";

/** Short staff-facing labels for manual-review filter chips and table cells. */
export function manualReviewReasonLabel(
  reason: ManualReviewReason | string | null | undefined,
): string {
  if (!reason) return "Manual review";
  const known = MANUAL_REVIEW_REASON_LABELS[reason as ManualReviewReason];
  if (known) return known;
  const words = reason.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
