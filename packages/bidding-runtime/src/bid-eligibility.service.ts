import type { IBidLotRulesReader } from "@auction/persistence/interfaces";
import { type Result, ok } from "neverthrow";
import { createBidEligibilityContext, createBidEligibilityRules } from "./bid-eligibility.rules.js";
import type { BidError } from "./bid-error.js";
import type { IAmlBidGate } from "./bid/aml-bid.gate.js";
import type { IBidAuthority } from "./bid/bid-authority.service.js";
import type { IBidderRoleGate } from "./bid/bidder-role.gate.js";
import { type IBiddingLimitGate, PerLotBiddingLimitGate } from "./bid/bidding-limit.gate.js";
import type { IBidIdentityEligibilityGate } from "./bid/identity-bid-eligibility.gate.js";
import type { OperatorPlacementPolicy } from "./bid/operator-placement-policy.js";
import type { SaleRegistrationBidGate } from "./bid/sale-registration-bid.gate.js";
import type { BidEligibilityCheckInput, IBidEligibility } from "./ports.js";

export class BidEligibilityService implements IBidEligibility {
  private readonly rules;

  constructor(
    identityEligibilityGate: IBidIdentityEligibilityGate,
    amlGate: IAmlBidGate,
    lotRulesReader: IBidLotRulesReader,
    bidAuthority: IBidAuthority,
    operatorPolicy: OperatorPlacementPolicy,
    saleRegistrationGate: SaleRegistrationBidGate,
    bidderRoleGate: IBidderRoleGate,
    biddingLimitGate: IBiddingLimitGate = new PerLotBiddingLimitGate(),
  ) {
    this.rules = createBidEligibilityRules({
      identityEligibilityGate,
      amlGate,
      lotRulesReader,
      bidAuthority,
      operatorPolicy,
      saleRegistrationGate,
      bidderRoleGate,
      biddingLimitGate,
    });
  }

  async assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>> {
    const ctx = createBidEligibilityContext(input);
    for (const rule of this.rules) {
      const result = await rule.apply(ctx);
      if (result.isErr()) return result;
    }
    return ok(undefined);
  }
}
