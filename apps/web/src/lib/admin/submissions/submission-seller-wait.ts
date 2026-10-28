import { agreementTermsComplete } from "@auction/domain";
import type { StatusPresentation } from "@auction/staff-ui";
import type { ConsignmentAgreement, ItemSubmissionStatus } from "@auction/types";

/**
 * What an accepted submission is waiting on before it can be catalogued, for the staff list:
 * terms staff still have to add, or the seller's acceptance. Nothing once accepted, or for any
 * other status.
 */
export function submissionSellerWait(
  status: ItemSubmissionStatus,
  agreement: Pick<
    ConsignmentAgreement,
    "acceptedAt" | "estimateLow" | "estimateHigh" | "commissionPercent"
  > | null,
): StatusPresentation | null {
  if (status !== "approved") return null;
  if (agreement?.acceptedAt) return null;
  if (!agreement || !agreementTermsComplete(agreement)) {
    return { label: "Add the terms", tone: "warning" };
  }
  return { label: "Waiting for the seller", tone: "info" };
}
