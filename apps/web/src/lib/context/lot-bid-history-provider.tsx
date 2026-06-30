"use client";

import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotBidHydrateQuery } from "@/hooks/lot-bid/use-lot-bid-hydrate-query";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import type { LotBidSnapshot } from "@/lib/bid/fetch-lot-bid-snapshot.client";
import {
  type OwnBidInput,
  reduceOnBidUpdate,
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
import {
  type LotBidHydrateData,
  buildLotBidInitialHydrate,
  fetchLotBidHydrate,
  lotBidKeys,
} from "@/lib/data/queries/lot-bid";
import { useQueryCacheState } from "@/lib/query/use-query-cache-state";
import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

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

type ProviderProps = {
  lotId: string;
  initialHistory: BidHistoryEntry[];
  initialCurrentPrice: string;
  initialLeadingBidderId?: string | null;
  currentUserId?: string | null;
  children: ReactNode;
};

function hydrateDataToContext(
  data: LotBidHydrateData,
): Omit<LotBidHistoryContextValue, "applyOwnBid" | "setEndedWinner" | "refreshFromServer"> {
  return {
    entries: data.entries,
    currentPrice: data.snapshot.currentPrice,
    leadingBidderId: data.leadingBidderId,
    latestSnapshotReserveMet: data.reserveMet,
  };
}

/** Single source of truth for lot bid history and live price on the marketing page. */
export function LotBidHistoryProvider({
  lotId,
  initialHistory,
  initialCurrentPrice,
  initialLeadingBidderId = null,
  currentUserId = null,
  children,
}: ProviderProps) {
  const queryClient = useQueryClient();
  const onlineLifecycle = useOnlineLotLifecycle();
  const noticeReporter = useLiveConnectivityNoticeReporterOptional();
  const localOwnBidRef = useRef<OwnBidEchoGuard | null>(null);
  const ownBidEchoGuardRef = onlineLifecycle?.ownBidEchoGuardRef ?? localOwnBidRef;

  const initialHydrate = useMemo(
    () =>
      buildLotBidInitialHydrate({
        lotId,
        initialHistory,
        initialCurrentPrice,
        initialLeadingBidderId,
      }),
    [lotId, initialHistory, initialCurrentPrice, initialLeadingBidderId],
  );

  const { refetch } = useLotBidHydrateQuery(lotId, {
    initialData: initialHydrate,
  });
  const hydrateData = useQueryCacheState(lotBidKeys.hydrate(lotId), initialHydrate);

  const patchHydrateCache = useCallback(
    (updater: (prev: LotBidHydrateData) => LotBidHydrateData) => {
      queryClient.setQueryData<LotBidHydrateData>(lotBidKeys.hydrate(lotId), (prev) =>
        updater(prev ?? initialHydrate),
      );
    },
    [queryClient, lotId, initialHydrate],
  );

  const applyLifecycleFromSnapshot = useCallback(
    (snapshot: LotBidSnapshot) => {
      const endMs = new Date(snapshot.endTime).getTime();
      onlineLifecycle?.setLiveEndTimeMs(endMs);
      onlineLifecycle?.setLiveLotStatus(snapshot.status);
    },
    [onlineLifecycle],
  );

  useEffect(() => {
    applyLifecycleFromSnapshot(hydrateData.snapshot);
  }, [hydrateData.snapshot, applyLifecycleFromSnapshot]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && hydrateData.snapshot.status !== "ended") {
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refetch, hydrateData.snapshot.status]);

  const applyOwnBid = useCallback(
    (bid: OwnBidInput) => {
      const bidderId = bid.bidderId ?? bid.placedByUserId ?? "";
      ownBidEchoGuardRef.current = {
        bidId: bid.id,
        amount: bid.amount,
        leadingBidderId: bidderId || null,
        at: Date.now(),
      };
      patchHydrateCache((prev) => {
        const nextState = reduceOnOwnBid(
          {
            entries: prev.entries,
            currentPrice: prev.snapshot.currentPrice,
            leadingBidderId: prev.leadingBidderId,
          },
          bid,
        );
        return {
          ...prev,
          entries: nextState.entries,
          leadingBidderId: nextState.leadingBidderId,
          snapshot: {
            ...prev.snapshot,
            currentPrice: nextState.currentPrice,
          },
        };
      });
    },
    [ownBidEchoGuardRef, patchHydrateCache],
  );

  const setEndedWinner = useCallback(
    (winnerId: string | null, currentPrice: string) => {
      patchHydrateCache((prev) => ({
        ...prev,
        leadingBidderId: winnerId,
        snapshot: {
          ...prev.snapshot,
          currentPrice,
          status: "ended",
          winnerId,
        },
      }));
    },
    [patchHydrateCache],
  );

  const refreshFromServer = useCallback(
    async (opts?: { silent?: boolean }): Promise<{
      ok: boolean;
      snapshot?: LotBidSnapshot;
    }> => {
      const noticeId = lotHydrateNoticeId(lotId);
      const hydrated = await fetchLotBidHydrate(lotId);
      if (!hydrated) {
        if (!opts?.silent) {
          noticeReporter?.reportNotice({
            id: noticeId,
            message: LIVE_CONNECTIVITY_COPY.lotHydrateFailed,
          });
        }
        return { ok: false };
      }

      queryClient.setQueryData(lotBidKeys.hydrate(lotId), hydrated);
      applyLifecycleFromSnapshot(hydrated.snapshot);
      noticeReporter?.clearNotice(noticeId);

      return { ok: true, snapshot: hydrated.snapshot };
    },
    [lotId, queryClient, noticeReporter, applyLifecycleFromSnapshot],
  );

  useLotRealtime(lotId, {
    onBidUpdate: (e: BidUpdateEvent) => {
      const skipPriceLeader = shouldSkipOwnBidEcho(
        e,
        ownBidEchoGuardRef.current,
        currentUserId ?? null,
      );
      patchHydrateCache((prev) => {
        const nextState = reduceOnBidUpdate(
          {
            entries: prev.entries,
            currentPrice: prev.snapshot.currentPrice,
            leadingBidderId: prev.leadingBidderId,
          },
          e,
          { skipPriceLeader },
        );
        return {
          ...prev,
          entries: nextState.entries,
          leadingBidderId: nextState.leadingBidderId,
          snapshot: skipPriceLeader
            ? prev.snapshot
            : {
                ...prev.snapshot,
                currentPrice: nextState.currentPrice,
              },
        };
      });
    },
    onLotEnded: (p) => {
      const ev = p as LotEndedEvent;
      patchHydrateCache((prev) => ({
        ...prev,
        leadingBidderId: ev.winnerId ?? null,
        snapshot: {
          ...prev.snapshot,
          currentPrice: ev.currentPrice,
          status: "ended",
          winnerId: ev.winnerId ?? null,
        },
      }));
    },
    onReconnect: () => {
      void refreshFromServer();
    },
  });

  const value = useMemo(
    (): LotBidHistoryContextValue => ({
      ...hydrateDataToContext(hydrateData),
      applyOwnBid,
      setEndedWinner,
      refreshFromServer,
    }),
    [hydrateData, applyOwnBid, setEndedWinner, refreshFromServer],
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
