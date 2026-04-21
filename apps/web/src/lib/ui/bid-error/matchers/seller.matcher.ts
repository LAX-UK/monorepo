import type { BidErrorMatcher, BidErrorPresentation } from "../types";

const MESSAGE = "Seller cannot bid on own lot";

export const sellerOwnLotBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== MESSAGE) return null;
    return {
      message: "You're the seller of this lot, so you can't place a bid.",
      severity: "info",
    };
  },
};
