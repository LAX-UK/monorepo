import {
  bulkBarBottomOffset,
  consentOffset,
  isFixedPayBarRoute,
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
      fixedPayBarRoute: false,
      hideDashboardTabBar: false,
    });
    expect(padding).toBe("1.5rem");
  });

  it("detects the Pay page, which carries its own pay bar", () => {
    expect(isFixedPayBarRoute("/purchases/pay")).toBe(true);
    expect(isFixedPayBarRoute("/purchases/checkout/abc-123")).toBe(false);
    expect(isFixedPayBarRoute("/purchases")).toBe(false);
    expect(isHideDashboardTabBarRoute("/selling/new")).toBe(true);
    expect(isHideDashboardTabBarRoute("/selling/consignments/abc-123")).toBe(true);
    expect(isHideDashboardTabBarRoute("/selling/consignments")).toBe(false);
  });

  it("uses pay bar padding on the Pay page", () => {
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
