import {
  AmlBidGate,
  BidEligibilityService,
  BuyerAgentBidGate,
  KycBidGate,
  NoOpAmlBidGate,
  NoOpKycBidGate,
  OperatorPlacementPolicy,
  SaleRegistrationBidGate,
} from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import {
  DrizzleBidLotRulesReader,
  DrizzleBidMembershipReader,
  DrizzleBuyerAgentAuthorisationReader,
  DrizzleOperatorPlacementReader,
  DrizzleSaleRegistrationBidReader,
} from "@auction/persistence/repositories";
import type { IAmlHoldStore } from "../services/aml/ports.js";
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
