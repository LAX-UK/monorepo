import { describe, expect, it } from "vitest";
import {
  DASHBOARD_BANNER_PRIORITIES,
  selectTopDashboardBannerCandidates,
} from "./dashboard-banner-priority";

describe("selectTopDashboardBannerCandidates", () => {
  it("returns empty for no candidates", () => {
    expect(selectTopDashboardBannerCandidates([], 2)).toEqual([]);
  });

  it("returns all when under cap", () => {
    const a = { id: "a", priority: DASHBOARD_BANNER_PRIORITIES.email, node: null };
    const b = { id: "b", priority: DASHBOARD_BANNER_PRIORITIES.org, node: null };
    expect(selectTopDashboardBannerCandidates([a, b], 2)).toEqual([b, a]);
  });

  it("keeps top two by priority and drops overflow", () => {
    const email = { id: "email", priority: DASHBOARD_BANNER_PRIORITIES.email, node: null };
    const org = { id: "org", priority: DASHBOARD_BANNER_PRIORITIES.org, node: null };
    const kyc = { id: "kyc", priority: DASHBOARD_BANNER_PRIORITIES.kyc, node: null };
    expect(selectTopDashboardBannerCandidates([email, org, kyc], 2)).toEqual([kyc, org]);
  });
});
