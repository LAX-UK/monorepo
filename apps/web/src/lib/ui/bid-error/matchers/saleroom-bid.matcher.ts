import type { BidErrorMatcher, BidErrorPresentation, MapBidErrorOptions } from "../types";

function matchesCode(options: MapBidErrorOptions | undefined, code: string, raw: string): boolean {
  if (options?.code === code) return true;
  return raw === code || raw.includes(code);
}

export const lotNotOnBlockBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "lot_not_on_block", raw)) return null;
    return {
      message: "This lot is not on the block — bidding opens when the auctioneer calls it.",
      severity: "info",
    };
  },
};

export const saleroomPausedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "saleroom_paused", raw)) return null;
    return {
      message: "The auction is paused — bidding will resume when the auctioneer continues.",
      severity: "info",
    };
  },
};
