import { resolvePostVerifyDestination } from "@/lib/auth/post-verify-destination";
import { describe, expect, it } from "vitest";

describe("resolvePostVerifyDestination", () => {
  it("starts the full flow once for a newly verified individual", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/watchlist",
        sessionPersona: "individual",
        fullBuyerOnboardingEnabled: true,
        categoryInterestsOnboardingCompletedAt: null,
      }),
    ).toEqual({
      href: "/onboarding/interests?next=%2Fdashboard%2Fwatchlist&source=post_verify",
      label: "Personalise your experience",
    });
    expect(
      resolvePostVerifyDestination({
        sessionPersona: "individual",
        fullBuyerOnboardingEnabled: true,
        categoryInterestsOnboardingCompletedAt: "2026-08-20T00:00:00.000Z",
      }).href,
    ).toBe("/dashboard");
  });

  it("does not start the full flow when completion state is unavailable", () => {
    expect(
      resolvePostVerifyDestination({
        sessionPersona: "individual",
        fullBuyerOnboardingEnabled: true,
      }).href,
    ).toBe("/dashboard");
  });

  it("does not send an already-approved buyer through identity onboarding", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/watchlist",
        sessionPersona: "individual",
        identityOnboardingEnabled: true,
        categoryInterestsOnboardingCompletedAt: "2026-08-20T00:00:00.000Z",
        kycStatus: "approved",
      }),
    ).toEqual({ href: "/dashboard/watchlist", label: "Continue" });
  });

  it("routes an individual through onboarding while preserving safe intent", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/watchlist",
        sessionPersona: "individual",
        identityOnboardingEnabled: true,
      }),
    ).toEqual({
      href: "/onboarding/identity?next=%2Fdashboard%2Fwatchlist&source=post_verify",
      label: "Set up identity verification",
    });
  });

  it("falls back safely when requested intent is malformed", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "//evil.example",
        sessionPersona: "individual",
        identityOnboardingEnabled: true,
      }).href,
    ).toBe("/onboarding/identity?next=%2Fdashboard&source=post_verify");
  });

  it("preserves organisation onboarding and safe organisation intent", () => {
    expect(
      resolvePostVerifyDestination({
        sessionPersona: "organisation",
        identityOnboardingEnabled: true,
        orgModuleEnabled: true,
      }),
    ).toEqual({
      href: "/onboarding/organisation",
      label: "Set up your organisation",
    });
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/organisations/123",
        sessionPersona: "organisation",
        identityOnboardingEnabled: true,
        orgModuleEnabled: true,
      }),
    ).toEqual({ href: "/dashboard/organisations/123", label: "Continue" });
  });

  it("restores the previous destination when rollout is disabled", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/watchlist",
        sessionPersona: "individual",
        identityOnboardingEnabled: false,
      }),
    ).toEqual({ href: "/dashboard/watchlist", label: "Continue" });
  });
});

describe("resolvePostVerifyDestination existing routing", () => {
  it("defaults to /dashboard when no persona signal exists", () => {
    expect(resolvePostVerifyDestination({})).toEqual({
      href: "/dashboard",
      label: "Go to dashboard",
    });
  });

  it("organisation persona from session routes to org onboarding", () => {
    expect(resolvePostVerifyDestination({ sessionPersona: "organisation" })).toEqual({
      href: "/onboarding/organisation",
      label: "Set up your organisation",
    });
  });

  it("individual persona from session routes to /dashboard", () => {
    expect(resolvePostVerifyDestination({ sessionPersona: "individual" })).toEqual({
      href: "/dashboard",
      label: "Go to dashboard",
    });
  });

  it("query persona is used when session has none", () => {
    expect(resolvePostVerifyDestination({ queryPersona: "organisation" })).toEqual({
      href: "/onboarding/organisation",
      label: "Set up your organisation",
    });
  });

  it("session persona wins over query persona", () => {
    expect(
      resolvePostVerifyDestination({
        queryPersona: "organisation",
        sessionPersona: "individual",
      }),
    ).toEqual({ href: "/dashboard", label: "Go to dashboard" });
  });

  it("safe ?next= wins over persona signal", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/sell/lots",
        sessionPersona: "organisation",
      }),
    ).toEqual({ href: "/dashboard/sell/lots", label: "Continue" });
  });

  it("unsafe ?next= is rejected and falls back to persona routing", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "//evil.example.com/path",
        sessionPersona: "organisation",
      }),
    ).toEqual({ href: "/onboarding/organisation", label: "Set up your organisation" });
  });

  it("organisation persona routes to dashboard when org module disabled", () => {
    expect(
      resolvePostVerifyDestination({
        sessionPersona: "organisation",
        orgModuleEnabled: false,
      }),
    ).toEqual({ href: "/dashboard", label: "Go to dashboard" });
  });

  it("unknown persona strings are ignored", () => {
    expect(
      resolvePostVerifyDestination({ queryPersona: "robot" as unknown as "individual" }),
    ).toEqual({ href: "/dashboard", label: "Go to dashboard" });
  });
});
