import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const dutchPriceBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "Bid must match current dutch price to accept") return null;
    return {
      message: "The Dutch price just moved — tap “Accept” again with the updated amount.",
      severity: "warning",
    };
  },
};
