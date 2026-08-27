import {
  AmlBidGate,
  BidEligibilityService,
  BidIdentityEligibilityGate,
  BuyerAgentBidGate,
  type IBidEligibility,
  type IBidIdentityEligibilityGate,
  type IKycThresholdGate,
  KycBidGate,
  NoOpKycBidGate,
  OperatorPlacementPolicy,
  SaleRegistrationBidGate,
  isKycBidEnforcementEnabled,
} from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import { resolveStrictBidEligibilityRollout } from "@auction/domain";
import type { IAmlHoldStore } from "@auction/persistence/interfaces";
import {
  DrizzleAmlHoldStore,
  DrizzleBidActorEligibilityReader,
  DrizzleBidLotRulesReader,
  DrizzleBidMembershipReader,
  DrizzleBuyerAgentAuthorisationReader,
  DrizzleKycRepository,
  DrizzleOperatorPlacementReader,
  DrizzleSaleRegistrationBidReader,
} from "@auction/persistence/repositories";
import { WorkerKycThresholdGate } from "../compliance/worker-kyc-threshold-gate.js";
import type { WorkerEnv } from "../env.js";

export type CreateWorkerBidEligibilityInput = {
  db: Database;
  env: Pick<WorkerEnv, "KYC_THRESHOLD_AMOUNT" | "ABSENTEE_REPLAY_OWNER"> &
    Partial<Pick<WorkerEnv, "STRICT_BID_ELIGIBILITY_ENABLED" | "APP_ENV">>;
  amlHoldStore?: IAmlHoldStore;
  kycThresholdGate?: IKycThresholdGate;
  identityEligibilityGate?: IBidIdentityEligibilityGate;
};

export function isWorkerBidKycEnforcementActive(
  env: Pick<WorkerEnv, "KYC_THRESHOLD_AMOUNT" | "ABSENTEE_REPLAY_OWNER">,
): boolean {
  if (env.ABSENTEE_REPLAY_OWNER === "worker") {
    return isKycBidEnforcementEnabled(env.KYC_THRESHOLD_AMOUNT);
  }
  return false;
}

export function createWorkerBidEligibility(
  input: CreateWorkerBidEligibilityInput,
): IBidEligibility {
  const { db, env } = input;
  const operatorReader = new DrizzleOperatorPlacementReader(db);
  const amlHoldStore = input.amlHoldStore ?? new DrizzleAmlHoldStore(db);
  const identityEligibilityGate =
    input.identityEligibilityGate ??
    createWorkerBidIdentityEligibilityGate(db, env, input.kycThresholdGate);

  return new BidEligibilityService(
    identityEligibilityGate,
    new AmlBidGate(amlHoldStore),
    new DrizzleBidLotRulesReader(db),
    new DrizzleBidMembershipReader(db),
    new OperatorPlacementPolicy(operatorReader),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
    new BuyerAgentBidGate(new DrizzleBuyerAgentAuthorisationReader(db)),
  );
}

export function createWorkerBidIdentityEligibilityGate(
  db: Database,
  env: Pick<WorkerEnv, "KYC_THRESHOLD_AMOUNT" | "ABSENTEE_REPLAY_OWNER"> &
    Partial<Pick<WorkerEnv, "STRICT_BID_ELIGIBILITY_ENABLED" | "APP_ENV">>,
  kycThresholdGate?: IKycThresholdGate,
): IBidIdentityEligibilityGate {
  const thresholdService =
    kycThresholdGate ??
    (isWorkerBidKycEnforcementActive(env)
      ? new WorkerKycThresholdGate(new DrizzleKycRepository(db), env.KYC_THRESHOLD_AMOUNT)
      : null);
  const thresholdGate = thresholdService ? new KycBidGate(thresholdService) : new NoOpKycBidGate();
  const enabled = resolveStrictBidEligibilityRollout({
    appEnv: env.APP_ENV,
    enabled: env.STRICT_BID_ELIGIBILITY_ENABLED,
  });
  return new BidIdentityEligibilityGate(
    new DrizzleBidActorEligibilityReader(db),
    thresholdGate,
    enabled,
  );
}
