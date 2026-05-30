"use client";

import { useLotPorts } from "@/lib/context/lot-ports";
import { useLotRealtimeContext } from "@/lib/context/lot-realtime-provider";
import type { LotRealtimeCallbacks } from "@/lib/realtime/contracts";
import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";
import { useEffect, useRef } from "react";

/** Subscribes to lot room events via shared provider or direct port fallback. */
export function useLotRealtime(lotId: string | null, callbacks: LotRealtimeCallbacks) {
  const { realtime } = useLotPorts();
  const broadcast = useLotRealtimeContext();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!lotId) return;

    const listener: LotRealtimeCallbacks = {
      onBidUpdate: (e: BidUpdateEvent) => cbRef.current.onBidUpdate?.(e),
      onLotExtended: (p: unknown) => cbRef.current.onLotExtended?.(p),
      onLotEnded: (p: LotEndedEvent) => cbRef.current.onLotEnded?.(p),
      onLotEvent: (p: unknown) => cbRef.current.onLotEvent?.(p),
    };

    if (broadcast) {
      return broadcast.register(listener);
    }

    return realtime.subscribeToLot(lotId, listener);
  }, [lotId, realtime, broadcast]);
}
