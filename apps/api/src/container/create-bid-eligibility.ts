import {
  AmlBidGate,
  BidAuthorityService,
  BidEligibilityService,
  BidIdentityEligibilityGate,
  type IBidAuthority,
  type IBidIdentityEligibilityGate,
  type ISelfServiceIdentityEligibilityGate,
  KycBidGate,
  NoOpAmlBidGate,
  NoOpKycBidGate,
  OperatorPlacementPolicy,
  SaleRegistrationBidGate,
  SelfServiceIdentityEligibilityGate,
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

export type CreateBidEligibilityInput = {
  db: Database;
  amlHoldStore: IAmlHoldStore;
  identityEligibilityGate: IBidIdentityEligibilityGate;
  bidAuthority?: IBidAuthority;
};

/** Who may bid for a legal entity; shared by every bidding channel. */
export function createBidAuthority(db: Database): IBidAuthority {
  return new BidAuthorityService(
    new DrizzleBidMembershipReader(db),
    new DrizzleBuyerAgentAuthorisationReader(db),
  );
}

export function createBidEligibility(input: CreateBidEligibilityInput): IBidEligibility {
  const { db, amlHoldStore, identityEligibilityGate } = input;
  const operatorReader = new DrizzleOperatorPlacementReader(db);
  return new BidEligibilityService(
    identityEligibilityGate,
    new AmlBidGate(amlHoldStore),
    new DrizzleBidLotRulesReader(db),
    input.bidAuthority ?? createBidAuthority(db),
    new OperatorPlacementPolicy(operatorReader),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
  );
}

export function createSelfServiceIdentityEligibilityGate(
  db: Database,
): ISelfServiceIdentityEligibilityGate {
  return new SelfServiceIdentityEligibilityGate(new DrizzleBidActorEligibilityReader(db));
}

export function createBidIdentityEligibilityGate(
  db: Database,
  kycService: IKycService | null,
  enabled: boolean,
): IBidIdentityEligibilityGate {
  const thresholdGate =
    kycService?.isConfigured() === true ? new KycBidGate(kycService) : new NoOpKycBidGate();
  return new BidIdentityEligibilityGate(
    new DrizzleBidActorEligibilityReader(db),
    thresholdGate,
    enabled,
  );
}

/** Test-only wiring when KYC/AML ports are absent. */
export function createBidEligibilityForTest(
  db: Database,
  opts?: {
    kycService?: IKycService | null;
    amlHoldStore?: IAmlHoldStore | null;
    strictBidEligibilityEnabled?: boolean;
  },
): BidEligibilityService {
  const operatorReader = new DrizzleOperatorPlacementReader(db);
  const identityEligibilityGate = createBidIdentityEligibilityGate(
    db,
    opts?.kycService ?? null,
    opts?.strictBidEligibilityEnabled ?? false,
  );
  return new BidEligibilityService(
    identityEligibilityGate,
    opts?.amlHoldStore ? new AmlBidGate(opts.amlHoldStore) : new NoOpAmlBidGate(),
    new DrizzleBidLotRulesReader(db),
    createBidAuthority(db),
    new OperatorPlacementPolicy(operatorReader),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
  );
}
