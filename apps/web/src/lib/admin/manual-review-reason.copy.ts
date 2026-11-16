import type { ManualReviewReason } from "@auction/types";

/** Every manual-review reason as staff read it. A new reason fails to compile until it is here. */
export const MANUAL_REVIEW_REASON_LABELS: Record<ManualReviewReason, string> = {
  seller_archived: "Archived seller",
  high_value: "High value",
  seller_archived_and_high_value: "Archived seller + high value",
  aml_hold: "AML hold",
  source_of_funds_required: "Source of funds required",
  finance_release_required: "Awaiting finance release",
  identity_verification_required: "Identity verification required",
  organisation_under_review: "Organisation under review",
};
