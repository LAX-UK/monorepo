"use client";

import { useLotPorts } from "@/lib/context/lot-ports";
import type { LotRealtimeCallbacks } from "@/lib/realtime/contracts";
import type { LotEndedEvent } from "@auction/types";
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
    // Each socket callback is relayed to every registered listener, in order. Every callback
    // takes at most one argument.
    const relay =
      (key: keyof Listener) =>
      (payload?: unknown): void => {
        for (const listener of listenersRef.current) {
          (listener[key] as ((payload?: unknown) => void) | undefined)?.(payload);
        }
      };
    const onLotEnded = relay("onLotEnded");
    return realtime.subscribeToLot(lotId, {
      onBidUpdate: relay("onBidUpdate"),
      onLotExtended: relay("onLotExtended"),
      onLotEnded: (p: LotEndedEvent) => {
        // Tells the header's outbid prompt (`lib/navigation/ended-lots.ts`) at once. The socket is
        // shared by the tab and `lotEnded` is not scoped to a room, so the close is announced by
        // the id the event names, never this provider's own. The name is `LOT_ENDED_SIGNAL`
        // (`lib/realtime/lot-ended-signal.ts`), written out so the lot page loads no extra module;
        // `lot-realtime-provider.test.tsx` fails if the two drift apart.
        window.dispatchEvent(new CustomEvent("lax:lot-ended", { detail: p.lotId }));
        onLotEnded(p);
      },
      onLotEvent: relay("onLotEvent"),
      onReconnect: relay("onReconnect"),
    });
  }, [lotId, realtime]);

  const value = useMemo(() => ({ register }), [register]);

  return <LotRealtimeContext.Provider value={value}>{children}</LotRealtimeContext.Provider>;
}

export function useLotRealtimeContext(): LotRealtimeContextValue | null {
  return useContext(LotRealtimeContext);
}
