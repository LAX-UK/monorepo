"use client";

import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { fetchLotBidHistory } from "@/lib/bid/fetch-lot-bid-history.client";
import { type LotBidSnapshot, fetchLotBidSnapshot } from "@/lib/bid/fetch-lot-bid-snapshot.client";
import {
  type LotBidHistoryState,
  type OwnBidInput,
  reduceOnBidUpdate,
  reduceOnHydrate,
  reduceOnOwnBid,
} from "@/lib/bid/lot-bid-history-reducer";
import type { OwnBidEchoGuard } from "@/lib/bid/own-bid-echo-guard";
import { shouldSkipOwnBidEcho } from "@/lib/bid/own-bid-echo-guard";
import {
  LIVE_CONNECTIVITY_COPY,
  lotHydrateNoticeId,
} from "@/lib/connection/live-connectivity-copy";
import { useLiveConnectivityNoticeReporterOptional } from "@/lib/connection/live-connectivity-notice";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { BidUpdateEvent, Lot, LotEndedEvent } from "@auction/types";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** How often to silently re-sync lot bid state while the tab is mounted. */
const RESYNC_INTERVAL_MS = 15_000;

type LotBidHistoryContextValue = {
  entries: BidHistoryEntry[];
  currentPrice: string;
  leadingBidderId: string | null;
  /** Latest server-synced reserveMet from snapshot (undefined until first hydrate completes). */
  latestSnapshotReserveMet: boolean | undefined;
  applyOwnBid: (bid: OwnBidInput) => void;
  setEndedWinner: (winnerId: string | null, currentPrice: string) => void;
  refreshFromServer: (opts?: { silent?: boolean }) => Promise<{
    ok: boolean;
    snapshot?: LotBidSnapshot;
  }>;
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
  const noticeReporter = useLiveConnectivityNoticeReporterOptional();
  const localOwnBidRef = useRef<OwnBidEchoGuard | null>(null);
  const ownBidEchoGuardRef = onlineLifecycle?.ownBidEchoGuardRef ?? localOwnBidRef;

  const [state, setState] = useState<LotBidHistoryState>(() => ({
    entries: initialHistory,
    currentPrice: initialCurrentPrice,
    leadingBidderId: initialLeadingBidderId,
  }));
  const [latestSnapshotReserveMet, setLatestSnapshotReserveMet] = useState<boolean | undefined>(
    undefined,
  );
  const lotStatusRef = useRef<Lot["status"] | null>(null);

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
    async (opts?: { silent?: boolean }): Promise<{
      ok: boolean;
      snapshot?: LotBidSnapshot;
    }> => {
      const noticeId = lotHydrateNoticeId(lotId);
      const [lotSnap, bidEntries] = await Promise.all([
        fetchLotBidSnapshot(lotId),
        fetchLotBidHistory(lotId),
      ]);
      if (!lotSnap || !bidEntries) {
        if (!opts?.silent) {
          noticeReporter?.reportNotice({
            id: noticeId,
            message: LIVE_CONNECTIVITY_COPY.lotHydrateFailed,
          });
        }
        return { ok: false };
      }
      lotStatusRef.current = lotSnap.status;
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
      const endMs = new Date(lotSnap.endTime).getTime();
      onlineLifecycle?.setLiveEndTimeMs(endMs);
      onlineLifecycle?.setLiveLotStatus(lotSnap.status);
      noticeReporter?.clearNotice(noticeId);
      if (lotSnap.reserveMet !== undefined) {
        setLatestSnapshotReserveMet(lotSnap.reserveMet);
      }
      return { ok: true, snapshot: lotSnap };
    },
    [lotId, onlineLifecycle, noticeReporter],
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
      lotStatusRef.current = "ended";
      setState((prev) => ({
        ...prev,
        currentPrice: ev.currentPrice,
        leadingBidderId: ev.winnerId ?? null,
      }));
    },
    onReconnect: () => {
      void hydrateFromServer();
    },
  });

  useEffect(() => {
    const silentHydrate = () => {
      if (lotStatusRef.current === "ended") return;
      void hydrateFromServer({ silent: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        silentHydrate();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = setInterval(silentHydrate, RESYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(intervalId);
    };
  }, [hydrateFromServer]);

  const value = useMemo(
    (): LotBidHistoryContextValue => ({
      entries: state.entries,
      currentPrice: state.currentPrice,
      leadingBidderId: state.leadingBidderId,
      latestSnapshotReserveMet,
      applyOwnBid,
      setEndedWinner,
      refreshFromServer: hydrateFromServer,
    }),
    [state, latestSnapshotReserveMet, applyOwnBid, setEndedWinner, hydrateFromServer],
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
