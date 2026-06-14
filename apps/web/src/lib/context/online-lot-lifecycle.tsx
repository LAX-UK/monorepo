"use client";

import type { Lot, Sale } from "@auction/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import type { OwnBidEchoGuard } from "@/lib/bid/own-bid-echo-guard";

export type { OwnBidEchoGuard };

type SalePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Ctx = {
  lot: Pick<
    Lot,
    "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
  >;
  sale: SalePick;
  extendedByMs: number | null;
  setExtendedDeltaMs: (deltaMs: number | null) => void;
  /** Authoritative end time after anti-snipe extend or reconnect hydrate. */
  liveEndTimeMs: number | null;
  setLiveEndTimeMs: (ms: number) => void;
  /** Lot status after reconnect hydrate (null until first server sync). */
  liveLotStatus: Lot["status"] | null;
  setLiveLotStatus: (status: Lot["status"]) => void;
  /** Mobile sticky coordination: bid card intersects viewport. */
  bidCardInView: boolean;
  setBidCardInView: (inView: boolean) => void;
  ownBidEchoGuardRef: import("react").MutableRefObject<OwnBidEchoGuard | null>;
};

const OnlineLotLifecycleContext = createContext<Ctx | null>(null);

type ProviderProps = {
  lot: Ctx["lot"];
  sale: SalePick;
  children: ReactNode;
};

export function OnlineLotLifecycleProvider({ lot, sale, children }: ProviderProps) {
  const [extendedByMs, setExtendedByMs] = useState<number | null>(null);
  const [liveEndTimeMs, setLiveEndTimeMs] = useState<number | null>(null);
  const [liveLotStatus, setLiveLotStatus] = useState<Lot["status"] | null>(null);
  const [bidCardInView, setBidCardInView] = useState(true);
  const ownBidEchoGuardRef = useRef<OwnBidEchoGuard | null>(null);

  const setExtendedDeltaMs = useCallback((deltaMs: number | null) => {
    setExtendedByMs(deltaMs);
  }, []);

  const value = useMemo(
    () => ({
      lot,
      sale,
      extendedByMs,
      setExtendedDeltaMs,
      liveEndTimeMs,
      setLiveEndTimeMs,
      liveLotStatus,
      setLiveLotStatus,
      bidCardInView,
      setBidCardInView,
      ownBidEchoGuardRef,
    }),
    [lot, sale, extendedByMs, setExtendedDeltaMs, liveEndTimeMs, liveLotStatus, bidCardInView],
  );

  return (
    <OnlineLotLifecycleContext.Provider value={value}>
      {children}
    </OnlineLotLifecycleContext.Provider>
  );
}

export function useOnlineLotLifecycle(): Ctx | null {
  return useContext(OnlineLotLifecycleContext);
}
