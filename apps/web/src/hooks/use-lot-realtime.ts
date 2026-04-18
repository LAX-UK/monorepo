"use client";

import { useLotPorts } from "@/lib/context/lot-ports";
import type { LotRealtimeCallbacks } from "@/lib/realtime/contracts";
import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";
import { useEffect, useRef } from "react";

/** Subscribes to lot room events via the injected realtime port (no raw socket in UI). */
export function useLotRealtime(lotId: string | null, callbacks: LotRealtimeCallbacks) {
  const { realtime } = useLotPorts();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!lotId) return;
    return realtime.subscribeToLot(lotId, {
      onBidUpdate: (e: BidUpdateEvent) => cbRef.current.onBidUpdate?.(e),
      onLotExtended: (p: unknown) => cbRef.current.onLotExtended?.(p),
      onLotEnded: (p: LotEndedEvent) => cbRef.current.onLotEnded?.(p),
      onLotEvent: (p: unknown) => cbRef.current.onLotEvent?.(p),
    });
  }, [lotId, realtime]);
}
