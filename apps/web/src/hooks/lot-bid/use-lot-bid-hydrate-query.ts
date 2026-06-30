"use client";

import { type LotBidHydrateData, lotBidHydrateQueryOptions } from "@/lib/data/queries/lot-bid";
import { LIVE_QUERY_STALE_TIME_MS, LIVE_RESYNC_INTERVAL_MS } from "@/lib/query/defaults";
import { useQuery } from "@tanstack/react-query";

type Options = {
  initialData: LotBidHydrateData;
};

/** Presentation hook: lot bid hydrate with periodic resync (replaces manual interval/visibility logic). */
export function useLotBidHydrateQuery(lotId: string, { initialData }: Options) {
  return useQuery({
    ...lotBidHydrateQueryOptions(lotId),
    initialData,
    staleTime: LIVE_QUERY_STALE_TIME_MS,
    refetchInterval: (query) =>
      query.state.data?.snapshot.status === "ended" ? false : LIVE_RESYNC_INTERVAL_MS,
    refetchOnWindowFocus: (query) => query.state.data?.snapshot.status !== "ended",
  });
}
