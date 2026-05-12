import type { Result } from "neverthrow";
import type { BidError } from "../../lib/errors.js";

export type BidEligibilityCheckInput = {
  placedByUserId: string;
  buyerLegalEntityId: string;
  lotId: string;
  amount: number;
};

/** Optional bidding gates (KYC, sale registration, buyer-agent caps) applied before bid tx. */
export interface IBidEligibility {
  assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>>;
}
