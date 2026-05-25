import { consentOffset, pageBottomPadding } from "@/lib/layout/bottom-chrome";
import { describe, expect, it } from "vitest";

describe("bottom-chrome", () => {
  it("offsets bid bar when consent banner is visible", () => {
    expect(consentOffset(true)).toBe("5.5rem");
    expect(consentOffset(false)).toBe("0px");
  });

  it("includes bid bar height on lot routes", () => {
    const padding = pageBottomPadding({
      consentBannerVisible: false,
      dashboardTabBarActive: false,
      marketingBidBarRoute: true,
    });
    expect(padding).toContain("4.5rem");
  });
});
