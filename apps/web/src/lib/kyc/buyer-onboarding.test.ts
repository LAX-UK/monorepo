import {
  buyerInterestsCompletionHref,
  fullBuyerOnboardingHref,
  shouldStartFullBuyerOnboardingAfterEmailVerification,
  shouldStartFullBuyerOnboardingAfterLogin,
} from "@/lib/kyc/buyer-onboarding";
import { describe, expect, it } from "vitest";

const newVerifiedBuyer = {
  role: "client" as const,
  suspended: false,
  emailVerified: true,
  signupPersona: "individual" as const,
  categoryInterestsOnboardingCompletedAt: null,
};

describe("buyer onboarding entry policy", () => {
  it("starts the full flow only for a newly verified incomplete individual", () => {
    expect(
      shouldStartFullBuyerOnboardingAfterEmailVerification({
        enabled: true,
        user: newVerifiedBuyer,
      }),
    ).toBe(true);
    for (const user of [
      { ...newVerifiedBuyer, categoryInterestsOnboardingCompletedAt: new Date() },
      { ...newVerifiedBuyer, signupPersona: "organisation" as const },
      { ...newVerifiedBuyer, role: "staff" as const },
      { ...newVerifiedBuyer, emailVerified: false },
      { ...newVerifiedBuyer, suspended: true },
    ]) {
      expect(shouldStartFullBuyerOnboardingAfterEmailVerification({ enabled: true, user })).toBe(
        false,
      );
    }
  });

  it("does not restart the full flow when the completion marker is unavailable", () => {
    const { categoryInterestsOnboardingCompletedAt: _marker, ...userWithoutMarker } =
      newVerifiedBuyer;
    expect(
      shouldStartFullBuyerOnboardingAfterLogin({
        enabled: true,
        user: userWithoutMarker,
      }),
    ).toBe(false);
  });

  it("resumes the full flow on login while interests onboarding is incomplete", () => {
    expect(
      shouldStartFullBuyerOnboardingAfterLogin({
        enabled: true,
        user: newVerifiedBuyer,
      }),
    ).toBe(true);
  });

  it("builds full-flow hrefs with safe intent", () => {
    expect(fullBuyerOnboardingHref("/dashboard/watchlist")).toBe(
      "/onboarding/interests?next=%2Fdashboard%2Fwatchlist&source=post_verify",
    );
    expect(fullBuyerOnboardingHref("//evil.example")).toBe(
      "/onboarding/interests?next=%2Fdashboard&source=post_verify",
    );
  });

  it("routes selected interests to recommendations and skip directly to KYC", () => {
    expect(buyerInterestsCompletionHref("/dashboard/watchlist", true)).toBe(
      "/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist&source=post_verify",
    );
    expect(buyerInterestsCompletionHref("/dashboard/watchlist", false)).toBe(
      "/onboarding/identity?next=%2Fdashboard%2Fwatchlist&source=post_verify",
    );
    expect(buyerInterestsCompletionHref("//evil.example", true)).toBe(
      "/onboarding/recommendations?next=%2Fdashboard&source=post_verify",
    );
  });
});
