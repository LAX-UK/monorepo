import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const kycRequiredBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "kyc_required") return null;
    return {
      message:
        "Identity verification is required for bids at your current exposure. Open the dashboard to verify with Stripe Identity.",
      severity: "error",
    };
  },
};
