import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const sealedClosedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "Sealed bids are only accepted while lot is active") return null;
    return {
      message: "Sealed bidding has closed for this lot.",
      severity: "info",
    };
  },
};
