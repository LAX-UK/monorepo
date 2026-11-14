"use client";

import { type LotBidHydrateData, lotBidHydrateQueryOptions } from "@/lib/data/queries/lot-bid";
import { LIVE_QUERY_STALE_TIME_MS, LIVE_RESYNC_INTERVAL_MS } from "@/lib/query/defaults";
import { useQuery } from "@tanstack/react-query";

type Options = {
  initialData: LotBidHydrateData;
};

/**
 * Presentation hook: lot bid hydrate with periodic resync (replaces manual interval/visibility logic).
 *
 * The page starts from a placeholder that carries no bid state (CO-7: the page is built from cached
 * reads), so the live price, status and close time are read as soon as the panel mounts
 * (`refetchOnMount: "always"`, whatever the infinite stale time says), and the socket keeps them
 * current from there.
 */
export function useLotBidHydrateQuery(lotId: string, { initialData }: Options) {
  return useQuery({
    ...lotBidHydrateQueryOptions(lotId),
    initialData,
    // The placeholder is never fresh.
    initialDataUpdatedAt: 0,
    refetchOnMount: "always",
    staleTime: LIVE_QUERY_STALE_TIME_MS,
    refetchInterval: (query) =>
      query.state.data?.snapshot.status === "ended" ? false : LIVE_RESYNC_INTERVAL_MS,
    refetchOnWindowFocus: (query) => query.state.data?.snapshot.status !== "ended",
  });
}
