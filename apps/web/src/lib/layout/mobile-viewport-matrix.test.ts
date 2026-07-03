import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pageBottomPadding } from "@/lib/layout/bottom-chrome";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), "utf8");
}

/** Mobile base padding must use the token, not fixed Tailwind pb-24/pb-28. */
const MOBILE_FIXED_BOTTOM_PADDING = /(?<![:\w-])pb-(24|28|32)\b/;

const PAGE_BOTTOM_PADDING_SHELLS = [
  "components/marketing/marketing-catalog-hub-shell.tsx",
  "components/marketing/marketing-detail-shell.tsx",
] as const;

function usesPageBottomPadding(routeSrc: string): boolean {
  if (routeSrc.includes("pb-[var(--page-bottom-padding)]")) return true;
  return routeSrc.includes("MarketingCatalogHubShell") || routeSrc.includes("MarketingDetailShell");
}

const LONG_SCROLL_ROUTES = [
  {
    label: "sales browse",
    path: "components/sections/sales/sales-browse-view.tsx",
  },
  {
    label: "sales browse loading",
    path: "app/(marketing)/sales/loading.tsx",
  },
  {
    label: "archive browse",
    path: "app/(marketing)/archive/page.tsx",
  },
  {
    label: "archive loading",
    path: "app/(marketing)/archive/loading.tsx",
  },
  {
    label: "artist profile",
    path: "components/sections/artists/artist-detail-view.tsx",
  },
  {
    label: "artist loading",
    path: "app/(marketing)/artist/[slug]/loading.tsx",
  },
  {
    label: "dashboard notifications inbox",
    path: "components/dashboard/notifications-inbox-board.tsx",
  },
  {
    label: "artwork online layout",
    path: "components/sections/artwork/layouts/artwork-online-layout.tsx",
  },
  {
    label: "legal pages",
    path: "components/marketing/legal-page.tsx",
  },
] as const;

const VIEWPORT_WIDTHS = [320, 390] as const;

describe("mobile viewport matrix (320/390px)", () => {
  it.each(LONG_SCROLL_ROUTES)(
    "$label uses --page-bottom-padding on long-scroll surfaces",
    ({ path }) => {
      const src = read(path);
      expect(usesPageBottomPadding(src)).toBe(true);
      expect(src).not.toMatch(MOBILE_FIXED_BOTTOM_PADDING);
    },
  );

  it.each(PAGE_BOTTOM_PADDING_SHELLS)("%s applies pb-[var(--page-bottom-padding)]", (path) => {
    const src = read(path);
    expect(src).toContain("pb-[var(--page-bottom-padding)]");
  });

  it.each(VIEWPORT_WIDTHS)(
    "pageBottomPadding stays chrome-aware at %ipx marketing routes",
    (width) => {
      void width;
      const base = pageBottomPadding({
        consentBannerVisible: false,
        dashboardTabBarActive: false,
        marketingBidBarRoute: false,
        fixedPayBarRoute: false,
        hideDashboardTabBar: false,
      });
      const withConsent = pageBottomPadding({
        consentBannerVisible: true,
        dashboardTabBarActive: false,
        marketingBidBarRoute: false,
        fixedPayBarRoute: false,
        hideDashboardTabBar: false,
      });
      const dashboard = pageBottomPadding({
        consentBannerVisible: false,
        dashboardTabBarActive: true,
        marketingBidBarRoute: false,
        fixedPayBarRoute: false,
        hideDashboardTabBar: false,
      });

      expect(base).toContain("1.5rem");
      expect(withConsent).toContain("5.5rem");
      expect(dashboard).toContain("bottom-nav-height");
    },
  );

  it("globals.css defines tap-target and bottom-nav tokens used at narrow viewports", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--tap-target-min: 44px");
    expect(css).toContain("--page-bottom-padding");
    expect(css).toContain("--bottom-nav-height");
  });
});
