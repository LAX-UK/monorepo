import {
  bulkBarBottomOffset,
  consentOffset,
  isFixedPayBarRoute,
  isHideDashboardTabBarRoute,
  pageBottomPadding,
} from "@/lib/layout/bottom-chrome";
import { describe, expect, it } from "vitest";

describe("bottom-chrome", () => {
  it("offsets bid bar when consent banner is visible", () => {
    expect(consentOffset(true)).toBe("5.5rem");
    expect(consentOffset(false)).toBe("0px");
  });

  it("includes bid bar height on lot routes when bar is active", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: false,
      dashboardTabBarActive: false,
      marketingBidBarRoute: true,
      marketingBidBarActive: true,
      fixedPayBarRoute: false,
      hideDashboardTabBar: false,
    });
    expect(padding).toContain("5rem");
  });

  it("omits bid bar height on lot routes when bar is hidden", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: false,
      dashboardTabBarActive: false,
      marketingBidBarRoute: true,
      marketingBidBarActive: false,
      fixedPayBarRoute: false,
      hideDashboardTabBar: false,
    });
    expect(padding).toBe("calc(1.5rem + 0px)");
  });

  it("detects lot checkout pay bar routes", () => {
    expect(isFixedPayBarRoute("/dashboard/checkout/abc-123")).toBe(true);
    expect(isFixedPayBarRoute("/dashboard/checkout")).toBe(false);
    expect(isHideDashboardTabBarRoute("/dashboard/submissions/new")).toBe(true);
    expect(isHideDashboardTabBarRoute("/dashboard/submissions/abc-123")).toBe(true);
    expect(isHideDashboardTabBarRoute("/dashboard/submissions")).toBe(false);
  });

  it("uses pay bar padding on lot checkout routes", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: false,
      dashboardTabBarActive: true,
      marketingBidBarRoute: false,
      fixedPayBarRoute: true,
      hideDashboardTabBar: true,
    });
    expect(padding).toContain("4.5rem");
    expect(padding).not.toContain("--bottom-nav-height");
  });

  it("computes bulk bar offset when dashboard tab bar is active", () => {
    expect(bulkBarBottomOffset(true)).toContain("--bottom-nav-height");
    expect(bulkBarBottomOffset(false)).toBe("0px");
  });
});
