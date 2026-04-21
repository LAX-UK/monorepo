import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const notAcceptingBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "Lot is not accepting bids") return null;
    return {
      message: "Bidding for this lot is paused.",
      severity: "info",
    };
  },
};
