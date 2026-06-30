"use client";

import { saleroomStatusQueryOptions } from "@/lib/data/queries/saleroom";
import { LIVE_QUERY_STALE_TIME_MS, LIVE_RESYNC_INTERVAL_MS } from "@/lib/query/defaults";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { useQuery } from "@tanstack/react-query";

type Options = {
  initialData: PublicSaleroomSessionStatus;
};

/** Presentation hook: saleroom status with periodic resync. */
export function useSaleroomStatusQuery(saleId: string, { initialData }: Options) {
  return useQuery({
    ...saleroomStatusQueryOptions(saleId),
    initialData,
    staleTime: LIVE_QUERY_STALE_TIME_MS,
    refetchInterval: LIVE_RESYNC_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
