import type { ManualReviewReason } from "@auction/types";

export function isComplianceManualReviewReason(
  reason: ManualReviewReason | null | undefined,
): boolean {
  return reason === "aml_hold" || reason === "source_of_funds_required";
}

export function manualReviewQueueEyebrow(reason: ManualReviewReason | null | undefined): string {
  if (isComplianceManualReviewReason(reason)) return "More checks needed";
  if (reason) return "Our team checks this payment";
  return "Payment being checked";
}
