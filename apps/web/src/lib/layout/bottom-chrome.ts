/** Fixed bottom chrome height tokens (match globals.css). */
export const BOTTOM_CHROME = {
  bid: "4.5rem",
  tab: "var(--bottom-nav-height, 4rem)",
  consent: "5.5rem",
} as const;

export type BottomChromeState = {
  consentBannerVisible: boolean;
  /** Dashboard mobile tab bar is mounted on this route. */
  dashboardTabBarActive: boolean;
  /** Marketing sticky bid bar may appear (lot / saleroom pages). */
  marketingBidBarRoute: boolean;
};

export function consentOffset(visible: boolean): string {
  return visible ? BOTTOM_CHROME.consent : "0px";
}

export function pageBottomPadding(state: BottomChromeState): string {
  const consent = consentOffset(state.consentBannerVisible);
  if (state.dashboardTabBarActive) {
    return `calc(${BOTTOM_CHROME.tab} + 1rem + ${consent})`;
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
