import type { DefaultOptions } from "@tanstack/react-query";

/** Default TanStack Query options — high staleTime; sockets / explicit invalidation drive freshness. */
export const QUERY_DEFAULT_OPTIONS: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  },
};

/** Live auction surfaces: sockets patch the cache; HTTP resync is a safety net. */
export const LIVE_QUERY_STALE_TIME_MS = Number.POSITIVE_INFINITY;

/** How often to silently re-sync live surfaces while mounted (matches prior Context providers). */
export const LIVE_RESYNC_INTERVAL_MS = 15_000;
