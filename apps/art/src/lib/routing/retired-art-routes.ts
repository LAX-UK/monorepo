import type { LaxAccountDestination } from "@auction/lax-ecosystem/lax-account-origin";

/** Where retired pages now live, resolved by the caller from this deployment's settings. */
export type RetiredArtRouteDestinations = {
  laxAccountUrl: (destination: LaxAccountDestination) => string;
  /** LAX Shop's base URL; null when Shop is not configured here. */
  shopBaseUrl: URL | null;
};

type RetiredArtRoute = (destinations: RetiredArtRouteDestinations) => string;

/**
 * lax.art pages that moved to another product. Prints are editions, sold in LAX Shop; the
 * collection and payouts are LAX Account pages. Answered in middleware, before rendering, so each
 * is a real permanent redirect rather than a page that streams and then navigates.
 */
const RETIRED_ART_ROUTES: Readonly<Record<string, RetiredArtRoute>> = {
  "/prints": ({ shopBaseUrl }) =>
    shopBaseUrl ? new URL("/artworks", shopBaseUrl).toString() : "/artworks",
  "/account/collection": ({ laxAccountUrl }) => laxAccountUrl("portfolio"),
  "/account/payouts": ({ laxAccountUrl }) => laxAccountUrl("sellingPayouts"),
};

/** The new home of a retired page, or null for any other path. */
export function resolveRetiredArtRoute(
  pathname: string,
  destinations: RetiredArtRouteDestinations,
): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const route = RETIRED_ART_ROUTES[path];
  return route ? route(destinations) : null;
}

/**
 * A lax.art location whose page has moved on resolves to that page's new home, query kept, so a
 * legacy URL mapped to a retired page still takes a single hop. Other locations are unchanged.
 */
export function followRetiredArtRoute(
  location: string,
  artBaseUrl: URL,
  destinations: RetiredArtRouteDestinations,
): string {
  const url = new URL(location, artBaseUrl);
  if (url.origin !== artBaseUrl.origin) return location;
  const moved = resolveRetiredArtRoute(url.pathname, destinations);
  if (!moved) return location;
  const target = new URL(moved, url);
  target.search = url.search;
  return target.toString();
}
