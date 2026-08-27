import { describe, expect, it } from "vitest";
import { evaluateSelfServiceActorIdentityEligibility } from "./self-service-actor-identity-eligibility.js";

describe("evaluateSelfServiceActorIdentityEligibility", () => {
  it("requires a verified email before considering KYC", () => {
    expect(
      evaluateSelfServiceActorIdentityEligibility({
        emailVerified: false,
        kycStatus: "approved",
      }),
    ).toEqual({ kind: "ineligible", code: "email_not_verified" });
  });

  it.each(["unverified", "pending", "rejected"] as const)(
    "requires approved KYC when status is %s",
    (kycStatus) => {
      expect(
        evaluateSelfServiceActorIdentityEligibility({
          emailVerified: true,
          kycStatus,
        }),
      ).toEqual({ kind: "ineligible", code: "kyc_required" });
    },
  );

  it("allows a verified actor with approved KYC", () => {
    expect(
      evaluateSelfServiceActorIdentityEligibility({
        emailVerified: true,
        kycStatus: "approved",
      }),
    ).toEqual({ kind: "eligible" });
  });
});
