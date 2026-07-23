import {
  AmlBidGate,
  BidEligibilityService,
  BuyerAgentBidGate,
  type IBidEligibility,
  type IKycThresholdGate,
  KycBidGate,
  NoOpKycBidGate,
  OperatorPlacementPolicy,
  SaleRegistrationBidGate,
  isKycBidEnforcementEnabled,
} from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import type { IAmlHoldStore } from "@auction/persistence/interfaces";
import {
  DrizzleAmlHoldStore,
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
  env: Pick<WorkerEnv, "KYC_THRESHOLD_AMOUNT" | "ABSENTEE_REPLAY_OWNER">;
  amlHoldStore?: IAmlHoldStore;
  kycThresholdGate?: IKycThresholdGate;
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
  const kycEnforcementActive = isWorkerBidKycEnforcementActive(env);
  const kycGate =
    input.kycThresholdGate ??
    (kycEnforcementActive
      ? new WorkerKycThresholdGate(new DrizzleKycRepository(db), env.KYC_THRESHOLD_AMOUNT)
      : null);

  return new BidEligibilityService(
    kycGate ? new KycBidGate(kycGate) : new NoOpKycBidGate(),
    new AmlBidGate(amlHoldStore),
    new DrizzleBidLotRulesReader(db),
    new DrizzleBidMembershipReader(db),
    new OperatorPlacementPolicy(operatorReader),
    new SaleRegistrationBidGate(new DrizzleSaleRegistrationBidReader(db)),
    new BuyerAgentBidGate(new DrizzleBuyerAgentAuthorisationReader(db)),
  );
}
