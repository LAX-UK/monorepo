import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const amlBlockedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "aml_blocked" && !raw.includes("aml_blocked")) return null;
    return {
      title: "Bidding suspended",
      message:
        "Your account is under compliance review. Contact settlements if you believe this is an error.",
      severity: "error",
    };
  },
};
