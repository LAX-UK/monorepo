import { BID_ERROR_CODES, matchesSellerOwnLotError, presentationForBidCode } from "../codes";
import type { BidErrorMatcher, MapBidErrorOptions } from "../types";

export const sellerOwnLotBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions) {
    if (!matchesSellerOwnLotError(raw, options?.code)) return null;
    return presentationForBidCode(BID_ERROR_CODES.seller_cannot_bid);
  },
};
