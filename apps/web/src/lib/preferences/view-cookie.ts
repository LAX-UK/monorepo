/** Max-age for per-route catalogue view cookies (60 days). */
export const VIEW_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 60;

export type CatalogLayoutView = "grid" | "card" | "list";

export function viewCookieName(routeKey: string): string {
  return `lax_view_${routeKey}`;
}

export function parseLayoutViewCookie(raw: string | undefined | null): CatalogLayoutView | null {
  if (raw === "grid" || raw === "card" || raw === "list") return raw;
  return null;
}
