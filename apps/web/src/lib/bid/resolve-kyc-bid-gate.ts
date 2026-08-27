import type { KycBidGateContext } from "@/lib/bid/policies/types";
import type { KycStatusSummaryDto, KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";

export const KYC_STATUS_UNAVAILABLE_FEEDBACK: KycUserFeedbackDto = {
  headline: "Identity verification unavailable",
  detail: "We couldn’t confirm your verification status. Try again in a moment.",
  action: "none",
  reasonCode: null,
  decisionStatus: null,
  needsResubmit: false,
};

export function resolveKycBidGate(input: {
  summary: KycStatusSummaryDto | null | undefined;
  unavailable?: boolean;
}): KycBidGateContext | null {
  if (input.unavailable) {
    return { requiresKyc: true, feedback: KYC_STATUS_UNAVAILABLE_FEEDBACK };
  }
  if (!input.summary) return null;
  return {
    requiresKyc: Boolean(input.summary.requiresKyc),
    feedback: input.summary.feedback ?? null,
  };
}

export function resolveKycSurfaceFeedback(input: {
  summary: KycStatusSummaryDto | null | undefined;
  unavailable?: boolean;
}): KycUserFeedbackDto | null {
  if (input.unavailable) return KYC_STATUS_UNAVAILABLE_FEEDBACK;
  return input.summary?.feedback ?? null;
}
