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

type SalePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

type Ctx = {
  lot: Pick<Lot, "status" | "startTime" | "endTime" | "winnerId" | "currentPrice" | "id"> & {
    hasWinner?: boolean | undefined;
  };
  sale: SalePick;
  extendedByMs: number | null;
  setExtendedDeltaMs: (deltaMs: number | null) => void;
  /** How many late bids have extended the lot since the page loaded. */
  extensionCount: number;
  /** A late bid moved the close: the new end time and how much it added. */
  applyExtension: (extension: { endTimeMs: number; addedMs: number | null }) => void;
  /** Authoritative end time after anti-snipe extend or reconnect hydrate. */
  liveEndTimeMs: number | null;
  setLiveEndTimeMs: (ms: number) => void;
  /** Lot status after reconnect hydrate or realtime lotEnded (null until first sync). */
  liveLotStatus: Lot["status"] | null;
  setLiveLotStatus: (status: Lot["status"]) => void;
  /** Winner after realtime lotEnded; null when passed unsold or unknown. */
  liveWinnerId: string | null;
  setLiveLotEnded: (result: { winnerId: string | null; noSale: boolean }) => void;
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
  const [liveWinnerId, setLiveWinnerId] = useState<string | null>(null);
  const [bidCardInView, setBidCardInView] = useState(true);
  const ownBidEchoGuardRef = useRef<OwnBidEchoGuard | null>(null);

  const [extensionCount, setExtensionCount] = useState(0);
  const applyExtension = useCallback((extension: { endTimeMs: number; addedMs: number | null }) => {
    setLiveEndTimeMs(extension.endTimeMs);
    setExtendedByMs(extension.addedMs);
    setExtensionCount((count) => count + 1);
  }, []);

  const setExtendedDeltaMs = useCallback((deltaMs: number | null) => {
    setExtendedByMs(deltaMs);
  }, []);

  const setLiveLotEnded = useCallback((result: { winnerId: string | null; noSale: boolean }) => {
    setLiveLotStatus("ended");
    setLiveWinnerId(result.noSale ? null : result.winnerId);
  }, []);

  const value = useMemo(
    () => ({
      lot,
      sale,
      extendedByMs,
      setExtendedDeltaMs,
      extensionCount,
      applyExtension,
      liveEndTimeMs,
      setLiveEndTimeMs,
      liveLotStatus,
      setLiveLotStatus,
      liveWinnerId,
      setLiveLotEnded,
      bidCardInView,
      setBidCardInView,
      ownBidEchoGuardRef,
    }),
    [
      lot,
      sale,
      extendedByMs,
      setExtendedDeltaMs,
      extensionCount,
      applyExtension,
      liveEndTimeMs,
      liveLotStatus,
      liveWinnerId,
      setLiveLotEnded,
      bidCardInView,
    ],
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
