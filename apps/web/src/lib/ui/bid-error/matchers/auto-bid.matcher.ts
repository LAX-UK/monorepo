import { BID_ERROR_CODES, BID_ERROR_PRESENTATIONS, presentationForBidCode } from "../codes";
import type { BidErrorMatcher, MapBidErrorOptions } from "../types";

export const autoBidDisabledBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions) {
    const code = options?.code;
    if (code !== BID_ERROR_CODES.auto_bid_disabled && raw !== BID_ERROR_CODES.auto_bid_disabled) {
      return null;
    }
    return presentationForBidCode(BID_ERROR_CODES.auto_bid_disabled);
  },
};

export const autoBidStepInvalidBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions) {
    const code = options?.code;
    if (
      code !== BID_ERROR_CODES.auto_bid_step_invalid &&
      raw !== BID_ERROR_CODES.auto_bid_step_invalid
    ) {
      return null;
    }
    return BID_ERROR_PRESENTATIONS.auto_bid_step_invalid;
  },
};
