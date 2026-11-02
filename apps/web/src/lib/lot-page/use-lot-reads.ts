"use client";

import { fetchLotViewer, fetchPublicBidHistory } from "@/lib/lot-page/lot-page-reads.client";
import { type LotViewerView, NO_LOT_VIEWER } from "@/lib/lot-page/lot-viewer";
import { LOT_HISTORY_LIMIT } from "@/lib/lot-page/public-bid-history-parse";
import type { PublicBidHistory } from "@auction/domain";
import { useQuery } from "@tanstack/react-query";

export const lotPageKeys = {
  viewer: (lotId: string) => ["lot-page", "viewer", lotId] as const,
  history: (lotId: string) => ["lot-page", "history", lotId] as const,
};

/**
 * Where the signed-in viewer stands on the lot. `revision` changes whenever the lot moves (a new
 * price, a new lifecycle), which reads the standing again so "leading" turns to "outbid" as it
 * happens. A signed-out visitor has no standing and costs no request.
 */
export function useLotViewer(input: {
  lotId: string;
  signedIn: boolean;
  revision: string;
  initial: LotViewerView | null;
}): LotViewerView {
  const query = useQuery({
    queryKey: [...lotPageKeys.viewer(input.lotId), input.revision],
    queryFn: () => fetchLotViewer(input.lotId),
    enabled: input.signedIn,
    // The server's reading holds the place until the first read lands, then the last one does.
    placeholderData: (previous) => previous ?? input.initial ?? undefined,
    staleTime: 5_000,
  });
  if (!input.signedIn) return NO_LOT_VIEWER;
  return query.data ?? input.initial ?? NO_LOT_VIEWER;
}

/** The anonymised bid history, read again whenever the lot moves. */
export function useLotPublicHistory(input: {
  lotId: string;
  enabled: boolean;
  revision: string;
  initial: PublicBidHistory | null;
}): PublicBidHistory | null {
  const query = useQuery({
    queryKey: [...lotPageKeys.history(input.lotId), input.revision],
    queryFn: () => fetchPublicBidHistory(input.lotId, LOT_HISTORY_LIMIT),
    enabled: input.enabled,
    // The server's reading holds the place until the first read lands, then the last one does.
    placeholderData: (previous) => previous ?? input.initial ?? undefined,
    staleTime: 5_000,
  });
  return query.data ?? input.initial ?? null;
}
