import { isClientAreaPath } from "@/lib/navigation/client-routes";
/** Fixed bottom chrome height tokens (match globals.css). */
export const BOTTOM_CHROME = {
  tab: "var(--bottom-nav-height, 4rem)",
  /** Until the dock has measured itself (first paint), a card's worth of space. */
  consent: "5.5rem",
} as const;

/** Fixed checkout pay bar height (matches checkout-lot-mobile-chrome). */
export const CHECKOUT_PAY_BAR = "4.5rem";

export type BottomChromeState = {
  consentBannerVisible: boolean;
  /** Dashboard mobile tab bar is mounted on this route. */
  dashboardTabBarActive: boolean;
  /** Lot checkout uses a fixed pay bar instead of the tab bar. */
  fixedPayBarRoute: boolean;
  /** Tab bar is hidden (wizard / lot checkout) — do not reserve tab height. */
  hideDashboardTabBar: boolean;
};

export function consentOffset(visible: boolean): string {
  return visible ? `var(--cookie-dock-height, ${BOTTOM_CHROME.consent})` : "0px";
}

/**
 * Padding for fixed bars only. The cookie dock, and the lot page's phone bar stacked in it, are
 * reserved once, on the body.
 */
export function pageBottomPadding(state: BottomChromeState): string {
  if (state.fixedPayBarRoute) {
    return `calc(${CHECKOUT_PAY_BAR} + 1rem + env(safe-area-inset-bottom, 0px))`;
  }
  if (state.dashboardTabBarActive && !state.hideDashboardTabBar) {
    return `calc(${BOTTOM_CHROME.tab} + 1rem + env(safe-area-inset-bottom, 0px))`;
  }
  return "1.5rem";
}

export function isDashboardTabBarRoute(pathname: string): boolean {
  return isClientAreaPath(pathname);
}

/** Single-lot checkout — fixed pay bar replaces tab bar on mobile. */
export function isFixedPayBarRoute(pathname: string): boolean {
  return /^\/purchases\/checkout\/[^/]+$/.test(pathname);
}

/** Routes that hide the dashboard tab bar while mounted. */
export function isHideDashboardTabBarRoute(pathname: string): boolean {
  if (isFixedPayBarRoute(pathname)) return true;
  if (pathname.startsWith("/selling/new")) return true;
  if (/^\/selling\/consignments\/[^/]+$/.test(pathname)) return true;
  return false;
}

/** Mobile bulk action bar bottom offset when dashboard tab bar is visible. */
export function bulkBarBottomOffset(dashboardTabBarActive: boolean): string {
  if (!dashboardTabBarActive) return "0px";
  return "calc(var(--bottom-nav-height, 64px) + var(--bottom-tab-bar-bottom, 0px))";
}
