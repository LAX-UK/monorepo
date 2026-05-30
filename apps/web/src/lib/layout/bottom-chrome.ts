/** Fixed bottom chrome height tokens (match globals.css). */
export const BOTTOM_CHROME = {
  bid: "4.5rem",
  tab: "var(--bottom-nav-height, 4rem)",
  consent: "5.5rem",
} as const;

/** Fixed checkout pay bar height (matches checkout-lot-mobile-chrome). */
export const CHECKOUT_PAY_BAR = "4.5rem";

export type BottomChromeState = {
  consentBannerVisible: boolean;
  /** Dashboard mobile tab bar is mounted on this route. */
  dashboardTabBarActive: boolean;
  /** Marketing sticky bid bar may appear (lot / saleroom pages). */
  marketingBidBarRoute: boolean;
  /** Lot checkout uses a fixed pay bar instead of the tab bar. */
  fixedPayBarRoute: boolean;
  /** Tab bar is hidden (wizard / lot checkout) — do not reserve tab height. */
  hideDashboardTabBar: boolean;
};

export function consentOffset(visible: boolean): string {
  return visible ? BOTTOM_CHROME.consent : "0px";
}

export function pageBottomPadding(state: BottomChromeState): string {
  const consent = consentOffset(state.consentBannerVisible);
  if (state.fixedPayBarRoute) {
    return `calc(${CHECKOUT_PAY_BAR} + 1rem + env(safe-area-inset-bottom, 0px) + ${consent})`;
  }
  if (state.dashboardTabBarActive && !state.hideDashboardTabBar) {
    return `calc(${BOTTOM_CHROME.tab} + 1rem + env(safe-area-inset-bottom, 0px) + ${consent})`;
  }
  if (state.marketingBidBarRoute) {
    return `calc(${BOTTOM_CHROME.bid} + 1.5rem + ${consent})`;
  }
  return `calc(1.5rem + ${consent})`;
}

export function isMarketingBidBarRoute(pathname: string): boolean {
  if (pathname.startsWith("/lot/")) return true;
  const segments = pathname.split("/").filter(Boolean);
  return segments[0] === "sales" && segments.length >= 3;
}

export function isDashboardTabBarRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
}

/** Single-lot checkout — fixed pay bar replaces tab bar on mobile. */
export function isFixedPayBarRoute(pathname: string): boolean {
  return /^\/dashboard\/checkout\/[^/]+$/.test(pathname);
}

/** Routes that hide the dashboard tab bar while mounted. */
export function isHideDashboardTabBarRoute(pathname: string): boolean {
  if (isFixedPayBarRoute(pathname)) return true;
  if (pathname.startsWith("/dashboard/submissions/new")) return true;
  if (/^\/dashboard\/submissions\/[^/]+$/.test(pathname)) return true;
  return false;
}

/** Mobile bulk action bar bottom offset when dashboard tab bar is visible. */
export function bulkBarBottomOffset(dashboardTabBarActive: boolean): string {
  if (!dashboardTabBarActive) return "0px";
  return "calc(var(--bottom-nav-height, 64px) + var(--bottom-tab-bar-bottom, 0px))";
}
