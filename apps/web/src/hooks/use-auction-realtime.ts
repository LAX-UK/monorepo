"use client";

import { useAuctionPorts } from "@/lib/context/auction-ports";
import type { AuctionRealtimeCallbacks } from "@/lib/realtime/contracts";
import type { AuctionEndedEvent, BidUpdateEvent } from "@auction/types";
import { useEffect, useRef } from "react";

/** Subscribes to auction room events via the injected realtime port (no raw socket in UI). */
export function useAuctionRealtime(auctionId: string | null, callbacks: AuctionRealtimeCallbacks) {
  const { realtime } = useAuctionPorts();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!auctionId) return;
    return realtime.subscribeToAuction(auctionId, {
      onBidUpdate: (e: BidUpdateEvent) => cbRef.current.onBidUpdate?.(e),
      onAuctionExtended: (p: unknown) => cbRef.current.onAuctionExtended?.(p),
      onAuctionEnded: (p: AuctionEndedEvent) => cbRef.current.onAuctionEnded?.(p),
      onAuctionEvent: (p: unknown) => cbRef.current.onAuctionEvent?.(p),
    });
  }, [auctionId, realtime]);
}
