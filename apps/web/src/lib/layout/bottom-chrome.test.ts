import {
  bulkBarBottomOffset,
  consentOffset,
  isHideDashboardTabBarRoute,
  pageBottomPadding,
  showsPublicBottomBar,
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
      hideDashboardTabBar: false,
    });
    expect(padding).toBe("1.5rem");
  });

  it("keeps the tab bar on the Pay page", () => {
    // It yields only while the page's own bar is mounted, and the page reserves that space itself.
    expect(isHideDashboardTabBarRoute("/purchases/pay")).toBe(false);
    expect(isHideDashboardTabBarRoute("/selling/new")).toBe(true);
    expect(isHideDashboardTabBarRoute("/selling/consignments/abc-123")).toBe(true);
    expect(isHideDashboardTabBarRoute("/selling/consignments")).toBe(false);
  });

  it("reserves the tab bar's height on the Pay page, and no more", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: false,
      dashboardTabBarActive: true,
      hideDashboardTabBar: false,
    });
    expect(padding).toContain("--bottom-nav-height");
  });

  it("computes bulk bar offset when dashboard tab bar is active", () => {
    expect(bulkBarBottomOffset(true)).toContain("--bottom-nav-height");
    expect(bulkBarBottomOffset(false)).toBe("0px");
  });

  describe("showsPublicBottomBar", () => {
    it("shows on the public pages", () => {
      for (const path of ["/", "/sales", "/sales/spring", "/lot/a/1", "/search", "/artists"]) {
        expect(showsPublicBottomBar(path)).toBe(true);
      }
    });

    it("is replaced by the account area's own bar inside the account area", () => {
      for (const path of ["/home", "/bids", "/purchases", "/watching", "/notifications"]) {
        expect(showsPublicBottomBar(path)).toBe(false);
      }
    });

    it("never shows on pay and checkout routes", () => {
      for (const path of [
        "/purchases/checkout",
        "/purchases/checkout/abc",
        "/pay",
        "/checkout/x",
      ]) {
        expect(showsPublicBottomBar(path)).toBe(false);
      }
    });
  });
});
