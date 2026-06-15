import type { ManualReviewReason } from "@auction/types";

/** Short staff-facing labels for manual-review filter chips and table cells. */
export function manualReviewReasonLabel(
  reason: ManualReviewReason | string | null | undefined,
): string {
  switch (reason) {
    case "seller_archived":
      return "Archived seller";
    case "high_value":
      return "High value";
    case "seller_archived_and_high_value":
      return "Archived seller + high value";
    case "aml_hold":
      return "AML hold";
    case "source_of_funds_required":
      return "Source of funds required";
    case "finance_release_required":
      return "Awaiting finance release";
    default:
      return reason ? reason.replaceAll("_", " ") : "Manual review";
  }
}
