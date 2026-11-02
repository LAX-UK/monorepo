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
    expect(consentOffset(true)).toBe("var(--cookie-dock-height, 5.5rem)");
    expect(consentOffset(false)).toBe("0px");
  });

  it("leaves the open cookie dock to the body, not the page padding", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: true,
      dashboardTabBarActive: false,
      fixedPayBarRoute: false,
      hideDashboardTabBar: false,
    });
    expect(padding).toBe("1.5rem");
  });

  it("detects lot checkout pay bar routes", () => {
    expect(isFixedPayBarRoute("/purchases/checkout/abc-123")).toBe(true);
    expect(isFixedPayBarRoute("/purchases/checkout")).toBe(false);
    expect(isHideDashboardTabBarRoute("/selling/new")).toBe(true);
    expect(isHideDashboardTabBarRoute("/selling/consignments/abc-123")).toBe(true);
    expect(isHideDashboardTabBarRoute("/selling/consignments")).toBe(false);
  });

  it("uses pay bar padding on lot checkout routes", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: false,
      dashboardTabBarActive: true,
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
