import { viewCookieName } from "@/lib/preferences/view-cookie";

/** All marketing route keys that set `lax_view_<key>` — used to clear cookies on reset. */
export const MARKETING_VIEW_COOKIE_ROUTE_KEYS = [
  "search",
  "archive",
  "sales",
  "sales-lot",
  "artists",
  "home-upcoming",
  "home-urgency",
] as const;

export function allMarketingViewCookieNames(): string[] {
  return [...MARKETING_VIEW_COOKIE_ROUTE_KEYS.map((k) => viewCookieName(k))];
}
