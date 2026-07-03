import type { Database } from "@auction/db";
import { DrizzleBidLotRulesReader } from "../repositories/drizzle-bid-lot-rules.reader.js";
import { DrizzleBidMembershipReader } from "../repositories/drizzle-bid-membership.reader.js";
import { DrizzleBuyerAgentAuthorisationReader } from "../repositories/drizzle-buyer-agent-authorisation.reader.js";
import { DrizzleOperatorPlacementReader } from "../repositories/drizzle-operator-placement.reader.js";
import { DrizzleSaleRegistrationBidReader } from "../repositories/drizzle-sale-registration-bid.reader.js";
import type { IAmlHoldStore } from "../services/aml/ports.js";
import { BidEligibilityService } from "../services/bid-eligibility.service.js";
import { AmlBidGate, NoOpAmlBidGate } from "../services/bid/aml-bid.gate.js";
import { BuyerAgentBidGate } from "../services/bid/buyer-agent-bid.gate.js";
import { KycBidGate, NoOpKycBidGate } from "../services/bid/kyc-bid.gate.js";
import { OperatorPlacementPolicy } from "../services/bid/operator-placement-policy.js";
import { SaleRegistrationBidGate } from "../services/bid/sale-registration-bid.gate.js";
import type { IBidEligibility } from "../services/interfaces/bid-eligibility.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";

export type CreateBidEligibilityInput = {
  db: Database;
  kycService: IKycService;
  amlHoldStore: IAmlHoldStore;
};

export function createBidEligibility(input: CreateBidEligibilityInput): IBidEligibility {
  const { db, kycService, amlHoldStore } = input;
  const operatorReader = new DrizzleOperatorPlacementReader(db);
  return new BidEligibilityService(
    kycService.isConfigured() ? new KycBidGate(kycService) : new NoOpKycBidGate(),
    new AmlBidGate(amlHoldStore),
    new DrizzleBidLotRulesReader(db),
    new DrizzleBidMembershipReader(db),
    new OperatorPlacementPolicy(operatorReader),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
    new BuyerAgentBidGate(new DrizzleBuyerAgentAuthorisationReader(db)),
  );
}

/** Test-only wiring when KYC/AML ports are absent. */
export function createBidEligibilityForTest(
  db: Database,
  opts?: { kycService?: IKycService | null; amlHoldStore?: IAmlHoldStore | null },
): BidEligibilityService {
  const operatorReader = new DrizzleOperatorPlacementReader(db);
  return new BidEligibilityService(
    opts?.kycService?.isConfigured() ? new KycBidGate(opts.kycService) : new NoOpKycBidGate(),
    opts?.amlHoldStore ? new AmlBidGate(opts.amlHoldStore) : new NoOpAmlBidGate(),
    new DrizzleBidLotRulesReader(db),
    new DrizzleBidMembershipReader(db),
    new OperatorPlacementPolicy(operatorReader),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
    new BuyerAgentBidGate(new DrizzleBuyerAgentAuthorisationReader(db)),
  );
}
