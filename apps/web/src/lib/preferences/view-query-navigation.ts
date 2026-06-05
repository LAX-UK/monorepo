import {
  type CatalogLayoutView,
  VIEW_COOKIE_MAX_AGE_SEC,
  viewCookieName,
} from "@/lib/preferences/view-cookie";

/**
 * Marketing layout view navigation contract (performance + SEO + SOLID):
 *
 * - **URL is source of truth** — server components read `?view=` via `resolveMarketingLayoutView`
 * - **Client switchers** call `useViewQueryNavigation` → `router.replace(href, { scroll: false })`
 * - **Canonical URLs** — omit `view` when it matches `defaultView` (usually `grid`)
 * - **Cookies** — per-route persistence via `routeKey` (see usages below)
 * - **Home page** — resolve `searchParams` outside the data-fetch `Suspense` boundary
 *
 * | Surface            | Switcher              | routeKey        | URL default |
 * |--------------------|-----------------------|-----------------|-------------|
 * | Home urgency       | CatalogViewSwitcher   | home-urgency    | grid        |
 * | Home upcoming      | CatalogViewSwitcher   | home-upcoming   | grid        |
 * | Search             | CatalogViewSwitcher   | search          | grid        |
 * | Archive            | CatalogViewSwitcher   | archive         | grid        |
 * | Artists            | CatalogViewSwitcher   | artists         | grid        |
 * | Saleroom catalogue | CatalogViewSwitcher   | sales-lot       | grid        |
 * | Sales calendar     | SalesViewSwitcher     | sales           | grid        |
 */

/** Query keys cleared when layout view changes (pagination resets). */
export const VIEW_CHANGE_CLEAR_PARAMS = ["page", "offset"] as const;

export type BuildViewQueryParamsOptions = {
  /** Param name (always `view` for marketing catalogues). */
  param?: string;
  /** Omit the param from the URL when it matches this value (cleaner canonical URLs). */
  defaultView: string;
  /** Extra params to remove on view change. */
  clearParams?: readonly string[];
};

/**
 * Build updated search params for a layout view change.
 * Pure helper — shared by catalog and sales view switchers.
 */
export function buildViewQueryParams(
  current: URLSearchParams | string,
  nextView: string,
  options: BuildViewQueryParamsOptions,
): URLSearchParams {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());
  const param = options.param ?? "view";

  if (nextView === options.defaultView) params.delete(param);
  else params.set(param, nextView);

  for (const key of options.clearParams ?? VIEW_CHANGE_CLEAR_PARAMS) {
    params.delete(key);
  }

  return params;
}

export function buildViewHref(
  pathname: string,
  current: URLSearchParams | string,
  nextView: string,
  options: BuildViewQueryParamsOptions,
): string {
  const qs = buildViewQueryParams(current, nextView, options).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Persist per-route layout preference (client-only). */
export function writeViewPreferenceCookie(
  routeKey: string,
  view: CatalogLayoutView | string,
): void {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${viewCookieName(routeKey)}=${view}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Sales calendar stores `grid` in the sales cookie when calendar mode is active. */
export function salesBrowseViewCookieValue(view: string): CatalogLayoutView {
  return view === "calendar" ? "grid" : (view as CatalogLayoutView);
}
