export type SelfServiceActorKycStatus = "unverified" | "pending" | "approved" | "rejected";

export type SelfServiceActorBidEligibilityInput = {
  emailVerified: boolean;
  kycStatus: SelfServiceActorKycStatus;
};

export type SelfServiceActorBidIneligibilityCode = "email_not_verified" | "kyc_required";

export type SelfServiceActorBidEligibility =
  | { kind: "eligible" }
  | { kind: "ineligible"; code: SelfServiceActorBidIneligibilityCode };

export function evaluateSelfServiceActorBidEligibility(
  input: SelfServiceActorBidEligibilityInput,
): SelfServiceActorBidEligibility {
  if (!input.emailVerified) {
    return { kind: "ineligible", code: "email_not_verified" };
  }
  if (input.kycStatus !== "approved") {
    return { kind: "ineligible", code: "kyc_required" };
  }
  return { kind: "eligible" };
}
