import { describe, expect, it } from "vitest";
import { evaluateKycThresholdRequirement } from "./evaluate-kyc-threshold.js";

describe("evaluateKycThresholdRequirement", () => {
  it("requires KYC when exposure meets threshold and user is not approved", () => {
    expect(
      evaluateKycThresholdRequirement({
        userKycStatus: "unverified",
        latestSessionStatus: null,
        exposureTotal: 1500,
        thresholdAmount: 1000,
      }).requiresKyc,
    ).toBe(true);
  });

  it("does not require KYC when approved despite high exposure", () => {
    expect(
      evaluateKycThresholdRequirement({
        userKycStatus: "approved",
        latestSessionStatus: "approved",
        exposureTotal: 5000,
        thresholdAmount: 1000,
      }).requiresKyc,
    ).toBe(false);
  });

  it("treats pending session created as unverified for threshold", () => {
    const result = evaluateKycThresholdRequirement({
      userKycStatus: "pending",
      latestSessionStatus: "created",
      exposureTotal: 2000,
      thresholdAmount: 1000,
    });
    expect(result.effectiveUserStatus).toBe("unverified");
    expect(result.requiresKyc).toBe(true);
  });
});
