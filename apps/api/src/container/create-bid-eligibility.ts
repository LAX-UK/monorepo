import {
  AmlBidGate,
  BidEligibilityService,
  BidIdentityEligibilityGate,
  BuyerAgentBidGate,
  KycBidGate,
  NoOpKycBidGate,
  OperatorPlacementPolicy,
  SaleRegistrationBidGate,
} from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import {
  DrizzleBidActorEligibilityReader,
  DrizzleBidLotRulesReader,
  DrizzleBidMembershipReader,
  DrizzleBuyerAgentAuthorisationReader,
  DrizzleOperatorPlacementReader,
  DrizzleSaleRegistrationBidReader,
} from "@auction/persistence/repositories";
import type { IAmlHoldStore } from "../services/aml/ports.js";
import type { IBidEligibility } from "../services/interfaces/bid-eligibility.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";

export function createBidEligibility(input: {
  db: Database;
  kycService: IKycService | null;
  amlHoldStore: IAmlHoldStore;
  strictEnabled: boolean;
}): IBidEligibility {
  const { db, kycService, amlHoldStore, strictEnabled } = input;
  const thresholdGate =
    kycService?.isConfigured() === true ? new KycBidGate(kycService) : new NoOpKycBidGate();
  const identityGate = new BidIdentityEligibilityGate(
    new DrizzleBidActorEligibilityReader(db),
    thresholdGate,
    strictEnabled,
  );
  return new BidEligibilityService(
    identityGate,
    new AmlBidGate(amlHoldStore),
    new DrizzleBidLotRulesReader(db),
    new DrizzleBidMembershipReader(db),
    new OperatorPlacementPolicy(new DrizzleOperatorPlacementReader(db)),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
    new BuyerAgentBidGate(new DrizzleBuyerAgentAuthorisationReader(db)),
  );
}
