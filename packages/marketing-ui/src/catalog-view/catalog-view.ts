import type { CatalogLayoutView } from "@auction/ui";

export type { CatalogLayoutView };

/**
 * Marketing catalogue layout view contract shared by Bid, Shop and Art:
 *
 * - **URL is the source of truth** — `?view=grid|card|list`; the param is omitted when it equals
 *   the surface default so canonical URLs stay clean.
 * - **Per-route cookie** — `lax_view_<routeKey>` remembers the last choice (60 days) so links that
 *   drop `?view=` (pagination, nav) keep the visitor's layout.
 * - **Client switch** — `history.replaceState` (no RSC refetch) via `useCatalogViewNavigation`;
 *   content renderers read the live value with `useCatalogLayoutView`.
 */
export const CATALOG_VIEW_PARAM = "view";

/** Max-age for per-route catalogue view cookies (60 days). */
export const VIEW_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 60;

/** Query keys cleared when layout view changes (offset pagination resets). */
export const VIEW_CHANGE_CLEAR_PARAMS = ["page", "offset"] as const;

export function viewCookieName(routeKey: string): string {
  return `lax_view_${routeKey}`;
}

export function parseLayoutViewCookie(raw: string | undefined | null): CatalogLayoutView | null {
  if (raw === "grid" || raw === "card" || raw === "list") return raw;
  return null;
}

/** URL → cookie → fallback, restricted to the modes the surface supports. */
export function resolveCatalogLayoutView(args: {
  urlView: string | null | undefined;
  cookieRaw: string | null | undefined;
  modes: readonly CatalogLayoutView[];
  fallback: CatalogLayoutView;
}): CatalogLayoutView {
  for (const candidate of [args.urlView, args.cookieRaw]) {
    const parsed = parseLayoutViewCookie(candidate);
    if (parsed && args.modes.includes(parsed)) return parsed;
  }
  return args.fallback;
}

export type BuildViewQueryParamsOptions = {
  /** Param name (always `view` for marketing catalogues). */
  param?: string;
  /** Omit the param from the URL when it matches this value (cleaner canonical URLs). */
  defaultView: string;
  /** Extra params to remove on view change. */
  clearParams?: readonly string[];
};

export function buildViewQueryParams(
  current: URLSearchParams | string,
  nextView: string,
  options: BuildViewQueryParamsOptions,
): URLSearchParams {
  const params = new URLSearchParams(typeof current === "string" ? current : current.toString());
  const param = options.param ?? CATALOG_VIEW_PARAM;

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
export function writeViewPreferenceCookie(routeKey: string, view: string): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${viewCookieName(routeKey)}=${view}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
