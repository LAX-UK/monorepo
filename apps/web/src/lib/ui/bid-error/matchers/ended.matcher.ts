import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const endedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "Lot has ended") return null;
    return {
      message: "This lot has ended.",
      severity: "info",
    };
  },
};
