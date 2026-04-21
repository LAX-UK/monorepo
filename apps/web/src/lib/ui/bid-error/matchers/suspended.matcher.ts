import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const suspendedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "Account suspended") return null;
    return {
      message: "Your account is suspended. Contact support to restore bidding.",
      severity: "error",
    };
  },
};
