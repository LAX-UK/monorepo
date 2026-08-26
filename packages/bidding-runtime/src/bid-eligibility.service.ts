import type { IBidLotRulesReader, IBidMembershipReader } from "@auction/persistence/interfaces";
import { type Result, ok } from "neverthrow";
import { createBidEligibilityContext, createBidEligibilityRules } from "./bid-eligibility.rules.js";
import type { BidError } from "./bid-error.js";
import type { IAmlBidGate } from "./bid/aml-bid.gate.js";
import type { BuyerAgentBidGate } from "./bid/buyer-agent-bid.gate.js";
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
    membershipReader: IBidMembershipReader,
    operatorPolicy: OperatorPlacementPolicy,
    saleRegistrationGate: SaleRegistrationBidGate,
    buyerAgentGate: BuyerAgentBidGate,
  ) {
    this.rules = createBidEligibilityRules({
      identityEligibilityGate,
      amlGate,
      lotRulesReader,
      membershipReader,
      operatorPolicy,
      saleRegistrationGate,
      buyerAgentGate,
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
