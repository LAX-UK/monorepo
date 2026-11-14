import { createMiddleware } from "hono/factory";

export type PublicCacheControlOptions = {
  sMaxAge: number;
  staleWhileRevalidate: number;
};

/**
 * One lot or one sale and what hangs off it (`/lots/:id`, `/lots/:id/bids`, `/lots/:id/bid-history`,
 * `/lots/:id/watch-count`, `/lots/:id/documents`, `/sales/:id`, `/sales/:id/lots`,
 * `/sales/:id/bidders`). The web app caches these behind the public sale and lot pages and drops
 * them by tag when the item changes, and the lot page reads the live bid state from the same
 * endpoints; a CDN copy would answer the read after a purge with what the purge dropped.
 */
const PUBLIC_ITEM_READ =
  /^\/(lots|sales)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

/** Item reads may be stored but must be checked with the API each time (the ETag makes that cheap). */
export const PUBLIC_ITEM_READ_CACHE_CONTROL = "public, no-cache";

export function isPublicItemReadPath(path: string): boolean {
  return PUBLIC_ITEM_READ.test(path);
}

/**
 * Sets cache headers when the request has no authenticated user context: CDN-friendly ones for the
 * catalogue lists, and none a CDN may answer from for a single lot or sale (see
 * `isPublicItemReadPath`), so a purge of the web app's cache is never undone by a CDN copy.
 */
export function createPublicCacheControlMiddleware(options: PublicCacheControlOptions) {
  const listValue = `public, s-maxage=${options.sMaxAge}, stale-while-revalidate=${options.staleWhileRevalidate}`;
  return createMiddleware<{
    Variables: { userId?: string };
  }>(async (c, next) => {
    await next();
    if (c.get("userId")) return;
    if (c.res.status >= 400) return;
    c.header(
      "Cache-Control",
      isPublicItemReadPath(c.req.path) ? PUBLIC_ITEM_READ_CACHE_CONTROL : listValue,
    );
  });
}
