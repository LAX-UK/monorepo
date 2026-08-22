import { resolveDashboardBannerSuppressions } from "@/components/dashboard/dashboard-banner-stack-client";
import { describe, expect, it } from "vitest";

describe("resolveDashboardBannerSuppressions", () => {
  it("shows proactive KYC while keeping overview email alerts suppressed", () => {
    expect(resolveDashboardBannerSuppressions("/dashboard", true)).toEqual({
      suppressKyc: false,
      suppressEmail: true,
    });
  });

  it("restores the previous overview behavior when onboarding is disabled", () => {
    expect(resolveDashboardBannerSuppressions("/dashboard", false)).toEqual({
      suppressKyc: true,
      suppressEmail: true,
    });
  });

  it("suppresses the KYC banner on the legacy verifier only", () => {
    expect(resolveDashboardBannerSuppressions("/dashboard/verify-identity", true)).toEqual({
      suppressKyc: true,
      suppressEmail: false,
    });
  });
});
