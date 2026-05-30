import { adminBidErrorMatcher } from "./matchers/admin.matcher";
import { alreadyLeadingBidErrorMatcher } from "./matchers/already-leading.matcher";
import { dutchPriceBidErrorMatcher } from "./matchers/dutch-price.matcher";
import {
  bidInFlightBidErrorMatcher,
  bidLimitExceededBidErrorMatcher,
  bidRateLimitedBidErrorMatcher,
  biddingDisabledBidErrorMatcher,
  buyerAgentAuthorisationBidErrorMatcher,
  entityNotAuthorisedBidErrorMatcher,
  membershipRequiredBidErrorMatcher,
  saleRegistrationRequiredBidErrorMatcher,
} from "./matchers/eligibility-api.matcher";
import { endedBidErrorMatcher } from "./matchers/ended.matcher";
import { kycRequiredBidErrorMatcher } from "./matchers/kyc-required.matcher";
import { minBidBidErrorMatcher } from "./matchers/min-bid.matcher";
import { notAcceptingBidErrorMatcher } from "./matchers/not-accepting.matcher";
import { sealedClosedBidErrorMatcher } from "./matchers/sealed-closed.matcher";
import { sellerOwnLotBidErrorMatcher } from "./matchers/seller.matcher";
import { suspendedBidErrorMatcher } from "./matchers/suspended.matcher";
import type { BidErrorMatcher, BidErrorPresentation, MapBidErrorOptions } from "./types";

export const defaultBidErrorMatchers: readonly BidErrorMatcher[] = [
  sellerOwnLotBidErrorMatcher,
  adminBidErrorMatcher,
  kycRequiredBidErrorMatcher,
  suspendedBidErrorMatcher,
  saleRegistrationRequiredBidErrorMatcher,
  bidLimitExceededBidErrorMatcher,
  membershipRequiredBidErrorMatcher,
  buyerAgentAuthorisationBidErrorMatcher,
  entityNotAuthorisedBidErrorMatcher,
  bidRateLimitedBidErrorMatcher,
  biddingDisabledBidErrorMatcher,
  bidInFlightBidErrorMatcher,
  alreadyLeadingBidErrorMatcher,
  notAcceptingBidErrorMatcher,
  endedBidErrorMatcher,
  minBidBidErrorMatcher,
  dutchPriceBidErrorMatcher,
  sealedClosedBidErrorMatcher,
] as const;

export function mapBidError(
  raw: string,
  options?: MapBidErrorOptions,
  matchers: readonly BidErrorMatcher[] = defaultBidErrorMatchers,
): BidErrorPresentation {
  const lookupKeys = [options?.code, raw].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  for (const key of lookupKeys) {
    for (const m of matchers) {
      const hit = m.match(key, options);
      if (hit) return hit;
    }
  }
  return { message: raw, severity: "error" };
}

export function clientBidError(message: string): BidErrorPresentation {
  return { message, severity: "error" };
}

export type {
  BidErrorMatcher,
  BidErrorPresentation,
  BidErrorSeverity,
  MapBidErrorOptions,
} from "./types";
