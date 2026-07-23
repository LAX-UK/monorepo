import type { UserKycStatus } from "@auction/types";

export type KycThresholdEvaluationInput = {
  userKycStatus: UserKycStatus | null | undefined;
  latestSessionStatus: string | null | undefined;
  exposureTotal: number;
  thresholdAmount: number;
};

export type KycThresholdEvaluation = {
  effectiveUserStatus: UserKycStatus;
  requiresKyc: boolean;
};

/** Shared bid-path KYC threshold rule (API gate + worker absentee replay). */
export function evaluateKycThresholdRequirement(
  input: KycThresholdEvaluationInput,
): KycThresholdEvaluation {
  const status: UserKycStatus = input.userKycStatus ?? "unverified";
  const latestSessionStatus = input.latestSessionStatus ?? null;
  const effectiveUserStatus: UserKycStatus =
    status === "pending" && latestSessionStatus === "created" ? "unverified" : status;
  const requiresKyc =
    input.exposureTotal >= input.thresholdAmount && effectiveUserStatus !== "approved";
  return { effectiveUserStatus, requiresKyc };
}

/** When true, bid paths must enforce exposure-based KYC (not Veriff session APIs). */
export function isKycBidEnforcementEnabled(thresholdAmount: number): boolean {
  return thresholdAmount > 0;
}
