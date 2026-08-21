import { describe, expect, it } from "vitest";
import { evaluateSelfServiceActorBidEligibility } from "./self-service-actor-bid-eligibility.js";

describe("evaluateSelfServiceActorBidEligibility", () => {
  it("requires a verified email before considering KYC", () => {
    expect(
      evaluateSelfServiceActorBidEligibility({
        emailVerified: false,
        kycStatus: "approved",
      }),
    ).toEqual({ kind: "ineligible", code: "email_not_verified" });
  });

  it.each(["unverified", "pending", "rejected"] as const)(
    "requires approved KYC when status is %s",
    (kycStatus) => {
      expect(
        evaluateSelfServiceActorBidEligibility({
          emailVerified: true,
          kycStatus,
        }),
      ).toEqual({ kind: "ineligible", code: "kyc_required" });
    },
  );

  it("allows a verified actor with approved KYC", () => {
    expect(
      evaluateSelfServiceActorBidEligibility({
        emailVerified: true,
        kycStatus: "approved",
      }),
    ).toEqual({ kind: "eligible" });
  });
});
