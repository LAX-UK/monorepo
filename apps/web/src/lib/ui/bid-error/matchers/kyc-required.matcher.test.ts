import { describe, expect, it } from "vitest";
import { kycRequiredBidErrorMatcher } from "./kyc-required.matcher";

describe("kycRequiredBidErrorMatcher", () => {
  it("uses feedback headline and detail when provided", () => {
    const result = kycRequiredBidErrorMatcher.match("kyc_required", {
      kycFeedback: {
        headline: "More information needed",
        detail: "Retake your selfie in good lighting.",
        action: "continue",
        needsResubmit: true,
      },
      verifyReturnPath: "/lot/foo/1",
    });
    expect(result).toMatchObject({
      title: "More information needed",
      message: "Retake your selfie in good lighting.",
      actionLabel: "Continue verification",
      actionHref: "/onboarding/identity?next=%2Flot%2Ffoo%2F1&source=bid_gate",
    });
  });

  it("falls back when feedback is missing", () => {
    const result = kycRequiredBidErrorMatcher.match("kyc_required");
    expect(result).toMatchObject({
      title: "Identity verification required",
      actionLabel: "Verify to continue bidding",
    });
  });
});
