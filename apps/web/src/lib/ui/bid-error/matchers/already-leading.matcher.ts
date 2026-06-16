import { BID_ERROR_CODES, matchesAlreadyLeadingError, presentationForBidCode } from "../codes";
import type { BidErrorMatcher, MapBidErrorOptions } from "../types";

export const alreadyLeadingBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions) {
    if (!matchesAlreadyLeadingError(raw, options?.code)) return null;
    return presentationForBidCode(BID_ERROR_CODES.already_leading);
  },
};
