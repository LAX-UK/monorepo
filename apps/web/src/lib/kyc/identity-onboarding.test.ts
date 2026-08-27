import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import {
  contextualIdentityOnboardingHref,
  identityOnboardingHref,
  legacyKycVerificationHref,
  resolveIdentityOnboardingNext,
  resolveIdentityOnboardingSource,
  shouldOfferIdentityOnboarding,
} from "@/lib/kyc/identity-onboarding";
import { describe, expect, it } from "vitest";

const unverified = { status: "none" } as unknown as KycStatusSummaryDto;
const approved = { status: "approved" } as unknown as KycStatusSummaryDto;

describe("identity onboarding policy", () => {
  it("preserves safe destinations and rejects open redirects or recursion", () => {
    expect(resolveIdentityOnboardingNext("/dashboard/watchlist?tab=active")).toBe(
      "/dashboard/watchlist?tab=active",
    );
    expect(resolveIdentityOnboardingNext("https://evil.example")).toBe("/dashboard");
    expect(resolveIdentityOnboardingNext("//evil.example")).toBe("/dashboard");
    expect(resolveIdentityOnboardingNext("/onboarding/identity/verify")).toBe("/dashboard");
  });

  it("builds a step URL with a safe destination and source", () => {
    expect(identityOnboardingHref("verify", "/dashboard/watchlist", "post_verify")).toBe(
      "/onboarding/identity/verify?next=%2Fdashboard%2Fwatchlist&source=post_verify",
    );
  });

  it("preserves only a safe destination when rolling back to the legacy verifier", () => {
    expect(legacyKycVerificationHref("/lot/example/123")).toBe(
      "/dashboard/verify-identity?next=%2Flot%2Fexample%2F123",
    );
    expect(legacyKycVerificationHref("//evil.example")).toBe(
      "/dashboard/verify-identity?next=%2Fdashboard",
    );
  });

  it("builds contextual hard-gate URLs with safe destination and source", () => {
    expect(contextualIdentityOnboardingHref("/lot/example/123", "bid_gate")).toBe(
      "/onboarding/identity?next=%2Flot%2Fexample%2F123&source=bid_gate",
    );
  });

  it("normalizes unknown analytics sources", () => {
    expect(resolveIdentityOnboardingSource("sign_in")).toBe("sign_in");
    expect(resolveIdentityOnboardingSource("dashboard")).toBe("dashboard");
    expect(resolveIdentityOnboardingSource("unknown")).toBe("direct");
  });

  it("offers proactive onboarding only to enabled unapproved individuals", () => {
    expect(
      shouldOfferIdentityOnboarding({
        enabled: true,
        summary: unverified,
        signupPersona: "individual",
      }),
    ).toBe(true);
    expect(
      shouldOfferIdentityOnboarding({
        enabled: true,
        summary: approved,
        signupPersona: "individual",
      }),
    ).toBe(false);
    expect(
      shouldOfferIdentityOnboarding({
        enabled: true,
        summary: unverified,
        signupPersona: "organisation",
      }),
    ).toBe(false);
    expect(
      shouldOfferIdentityOnboarding({
        enabled: false,
        summary: unverified,
        signupPersona: "individual",
      }),
    ).toBe(false);
  });
});
