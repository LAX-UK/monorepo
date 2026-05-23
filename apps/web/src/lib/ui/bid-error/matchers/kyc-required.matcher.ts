import type { BidErrorMatcher, BidErrorPresentation, MapBidErrorOptions } from "../types";

function verifyIdentityHref(returnPath?: string): string {
  return returnPath
    ? `/dashboard/verify-identity?next=${encodeURIComponent(returnPath)}`
    : "/dashboard/verify-identity";
}

export const kycRequiredBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (raw !== "kyc_required" && !raw.includes("kyc_required")) return null;
    return {
      title: "Identity verification required",
      message: "Identity verification is required for bids at your current exposure.",
      severity: "error",
      actionHref: verifyIdentityHref(options?.verifyReturnPath),
      actionLabel: "Verify identity",
    };
  },
};
