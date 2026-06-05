"use client";

import { useLotPorts } from "@/lib/context/lot-ports";
import type { LotRealtimeCallbacks } from "@/lib/realtime/contracts";
import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

type Listener = Partial<LotRealtimeCallbacks>;

type LotRealtimeContextValue = {
  register: (listener: Listener) => () => void;
};

const LotRealtimeContext = createContext<LotRealtimeContextValue | null>(null);

/** Single socket subscription per lot; fan-out to child hooks. */
export function LotRealtimeProvider({
  lotId,
  children,
}: {
  lotId: string;
  children: ReactNode;
}) {
  const { realtime } = useLotPorts();
  const listenersRef = useRef(new Set<Listener>());

  const register = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!lotId) return;
    const fanOut = (fn: (l: Listener) => void) => {
      for (const l of listenersRef.current) {
        fn(l);
      }
    };
    return realtime.subscribeToLot(lotId, {
      onBidUpdate: (e: BidUpdateEvent) => fanOut((l) => l.onBidUpdate?.(e)),
      onLotExtended: (p: unknown) => fanOut((l) => l.onLotExtended?.(p)),
      onLotEnded: (p: LotEndedEvent) => fanOut((l) => l.onLotEnded?.(p)),
      onLotEvent: (p: unknown) => fanOut((l) => l.onLotEvent?.(p)),
      onReconnect: () => fanOut((l) => l.onReconnect?.()),
    });
  }, [lotId, realtime]);

  const value = useMemo(() => ({ register }), [register]);

  return <LotRealtimeContext.Provider value={value}>{children}</LotRealtimeContext.Provider>;
}

export function useLotRealtimeContext(): LotRealtimeContextValue | null {
  return useContext(LotRealtimeContext);
}
