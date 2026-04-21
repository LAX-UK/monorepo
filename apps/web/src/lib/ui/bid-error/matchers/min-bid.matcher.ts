import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const minBidBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (!/^Bid must be at least\b/.test(raw)) return null;
    return { message: raw, severity: "error" };
  },
};
