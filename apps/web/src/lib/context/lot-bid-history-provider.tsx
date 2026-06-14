"use client";

import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { fetchLotBidHistory } from "@/lib/bid/fetch-lot-bid-history.client";
import { fetchLotBidSnapshot } from "@/lib/bid/fetch-lot-bid-snapshot.client";
import {
  type LotBidHistoryState,
  type OwnBidInput,
  reduceOnBidUpdate,
  reduceOnHydrate,
  reduceOnOwnBid,
} from "@/lib/bid/lot-bid-history-reducer";
import type { OwnBidEchoGuard } from "@/lib/bid/own-bid-echo-guard";
import { shouldSkipOwnBidEcho } from "@/lib/bid/own-bid-echo-guard";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { notify } from "@/lib/ui/notify";
import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type LotBidHistoryContextValue = {
  entries: BidHistoryEntry[];
  currentPrice: string;
  leadingBidderId: string | null;
  applyOwnBid: (bid: OwnBidInput) => void;
  setEndedWinner: (winnerId: string | null, currentPrice: string) => void;
  refreshFromServer: () => Promise<boolean>;
};

const LotBidHistoryContext = createContext<LotBidHistoryContextValue | null>(null);

function deriveLeadingBidderId(entries: BidHistoryEntry[]): string | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => {
    const na = Number.parseFloat(a.amount);
    const nb = Number.parseFloat(b.amount);
    if (nb !== na) return nb - na;
    return b.at - a.at;
  });
  return sorted[0]?.bidderId ?? null;
}

type ProviderProps = {
  lotId: string;
  initialHistory: BidHistoryEntry[];
  initialCurrentPrice: string;
  initialLeadingBidderId?: string | null;
  currentUserId?: string | null;
  children: ReactNode;
};

/** Single source of truth for lot bid history and live price on the marketing page. */
export function LotBidHistoryProvider({
  lotId,
  initialHistory,
  initialCurrentPrice,
  initialLeadingBidderId = null,
  currentUserId = null,
  children,
}: ProviderProps) {
  const onlineLifecycle = useOnlineLotLifecycle();
  const localOwnBidRef = useRef<OwnBidEchoGuard | null>(null);
  const ownBidEchoGuardRef = onlineLifecycle?.ownBidEchoGuardRef ?? localOwnBidRef;

  const [state, setState] = useState<LotBidHistoryState>(() => ({
    entries: initialHistory,
    currentPrice: initialCurrentPrice,
    leadingBidderId: initialLeadingBidderId,
  }));

  const applyOwnBid = useCallback(
    (bid: OwnBidInput) => {
      const bidderId = bid.bidderId ?? bid.placedByUserId ?? "";
      ownBidEchoGuardRef.current = {
        bidId: bid.id,
        amount: bid.amount,
        leadingBidderId: bidderId || null,
        at: Date.now(),
      };
      setState((prev) => reduceOnOwnBid(prev, bid));
    },
    [ownBidEchoGuardRef],
  );

  const setEndedWinner = useCallback((winnerId: string | null, currentPrice: string) => {
    setState((prev) => ({
      ...prev,
      currentPrice,
      leadingBidderId: winnerId,
    }));
  }, []);

  const hydrateFromServer = useCallback(
    async (opts?: { fromReconnect?: boolean }): Promise<boolean> => {
      const [lotSnap, bidEntries] = await Promise.all([
        fetchLotBidSnapshot(lotId),
        fetchLotBidHistory(lotId),
      ]);
      if (!lotSnap || !bidEntries) {
        notify.warning("Could not refresh live prices", {
          id: `lot-hydrate-failed-${lotId}`,
          description: "Showing last known bids until the connection recovers.",
          duration: 7000,
        });
        return false;
      }
      const leadingBidderId =
        lotSnap.status === "ended"
          ? (lotSnap.winnerId ?? deriveLeadingBidderId(bidEntries))
          : deriveLeadingBidderId(bidEntries);
      setState((prev) =>
        reduceOnHydrate(prev, {
          currentPrice: lotSnap.currentPrice,
          leadingBidderId,
          entries: bidEntries,
        }),
      );
      if (opts?.fromReconnect) {
        notify.success("Reconnected — live prices refreshed", {
          id: `lot-reconnect-${lotId}`,
          duration: 5000,
        });
      }
      return true;
    },
    [lotId],
  );

  useLotRealtime(lotId, {
    onBidUpdate: (e: BidUpdateEvent) => {
      const skipPriceLeader = shouldSkipOwnBidEcho(
        e,
        ownBidEchoGuardRef.current,
        currentUserId ?? null,
      );
      setState((prev) => reduceOnBidUpdate(prev, e, { skipPriceLeader }));
    },
    onLotEnded: (p) => {
      const ev = p as LotEndedEvent;
      setState((prev) => ({
        ...prev,
        currentPrice: ev.currentPrice,
        leadingBidderId: ev.winnerId ?? null,
      }));
    },
    onReconnect: () => {
      void hydrateFromServer({ fromReconnect: true });
    },
  });

  const value = useMemo(
    (): LotBidHistoryContextValue => ({
      entries: state.entries,
      currentPrice: state.currentPrice,
      leadingBidderId: state.leadingBidderId,
      applyOwnBid,
      setEndedWinner,
      refreshFromServer: hydrateFromServer,
    }),
    [state, applyOwnBid, setEndedWinner, hydrateFromServer],
  );

  return <LotBidHistoryContext.Provider value={value}>{children}</LotBidHistoryContext.Provider>;
}

export function useLotBidHistory(): LotBidHistoryContextValue {
  const ctx = useContext(LotBidHistoryContext);
  if (!ctx) {
    throw new Error("useLotBidHistory must be used within LotBidHistoryProvider");
  }
  return ctx;
}

/** Optional accessor when provider may be absent (e.g. tests). */
export function useLotBidHistoryOptional(): LotBidHistoryContextValue | null {
  return useContext(LotBidHistoryContext);
}
