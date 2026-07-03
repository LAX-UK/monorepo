"use client";

import { type UsePlaceBidParams, usePlaceBid } from "@/hooks/lot-bid/use-place-bid";
import type { UseLotBidStateResult } from "@/hooks/use-lot-bid-state";

export type UseArtworkBidPanelStateParams = UsePlaceBidParams;

export function useArtworkBidPanelState(params: UseArtworkBidPanelStateParams) {
  return usePlaceBid(params);
}

export type { UseLotBidStateResult };
