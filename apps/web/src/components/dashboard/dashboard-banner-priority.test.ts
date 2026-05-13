import { describe, expect, it } from "vitest";
import {
  DASHBOARD_BANNER_PRIORITIES,
  selectTopDashboardBannerCandidates,
} from "./dashboard-banner-priority";

describe("selectTopDashboardBannerCandidates", () => {
  it("orders org onboarding resume between KYC and entity status", () => {
    const chosen = selectTopDashboardBannerCandidates(
      [
        { id: "email", priority: DASHBOARD_BANNER_PRIORITIES.email, node: "e" },
        { id: "org", priority: DASHBOARD_BANNER_PRIORITIES.org, node: "o" },
        { id: "resume", priority: DASHBOARD_BANNER_PRIORITIES.orgOnboardingResume, node: "r" },
        { id: "kyc", priority: DASHBOARD_BANNER_PRIORITIES.kyc, node: "k" },
      ],
      2,
    );
    expect(chosen.map((c) => c.id)).toEqual(["kyc", "resume"]);
  });
});
