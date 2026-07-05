import { kycLinkActionLabel } from "@/lib/kyc/kyc-link-action-copy";
import type { BidErrorMatcher, BidErrorPresentation, MapBidErrorOptions } from "../types";

function verifyIdentityHref(returnPath?: string): string {
  return returnPath
    ? `/dashboard/verify-identity?next=${encodeURIComponent(returnPath)}`
    : "/dashboard/verify-identity";
}

export const kycRequiredBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (raw !== "kyc_required" && !raw.includes("kyc_required")) return null;
    const feedback = options?.kycFeedback;
    return {
      title: feedback?.headline ?? "Identity verification required",
      message:
        feedback?.detail ?? "Identity verification is required for bids at your current exposure.",
      severity: "error",
      actionHref: verifyIdentityHref(options?.verifyReturnPath),
      actionLabel: feedback ? kycLinkActionLabel(feedback, "long") : "Verify identity",
    };
  },
};
