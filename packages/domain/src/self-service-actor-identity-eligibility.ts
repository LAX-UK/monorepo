export type SelfServiceActorKycStatus = "unverified" | "pending" | "approved" | "rejected";

export type SelfServiceActorIdentityEligibilityInput = {
  emailVerified: boolean;
  kycStatus: SelfServiceActorKycStatus;
};

export type SelfServiceActorIdentityIneligibilityCode = "email_not_verified" | "kyc_required";

export type SelfServiceActorIdentityEligibility =
  | { kind: "eligible" }
  | { kind: "ineligible"; code: SelfServiceActorIdentityIneligibilityCode };

export function evaluateSelfServiceActorIdentityEligibility(
  input: SelfServiceActorIdentityEligibilityInput,
): SelfServiceActorIdentityEligibility {
  if (!input.emailVerified) {
    return { kind: "ineligible", code: "email_not_verified" };
  }
  if (input.kycStatus !== "approved") {
    return { kind: "ineligible", code: "kyc_required" };
  }
  return { kind: "eligible" };
}
