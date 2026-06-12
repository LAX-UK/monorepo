import { createMiddleware } from "hono/factory";

export type PublicCacheControlOptions = {
  sMaxAge: number;
  staleWhileRevalidate: number;
};

/** Sets CDN-friendly cache headers when the request has no authenticated user context. */
export function createPublicCacheControlMiddleware(options: PublicCacheControlOptions) {
  const value = `public, s-maxage=${options.sMaxAge}, stale-while-revalidate=${options.staleWhileRevalidate}`;
  return createMiddleware<{
    Variables: { userId?: string };
  }>(async (c, next) => {
    await next();
    if (c.get("userId")) return;
    if (c.res.status >= 400) return;
    c.header("Cache-Control", value);
  });
}
