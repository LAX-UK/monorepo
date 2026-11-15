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
  fetchLotBidHydrate,
  isLiveLotBidHydrate,
  lotBidKeys,
  pendingLotBidHydrate,
} from "@/lib/data/queries/lot-bid";
import { heardIsNewer, readsAsExtended, reconcileEnd } from "@/lib/lot-page/reconcile-end";
import { useQueryCacheState } from "@/lib/query/use-query-cache-state";
import { parseLotExtension } from "@/lib/realtime/lot-extension";
import { browserClockSync } from "@/lib/time/browser-clock-sync.client";
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
  /**
   * False until the first live (no-store) read lands. Until then nothing below is the lot's real
   * state: the page draws placeholders, starts no clock and keeps bidding shut (CO-7).
   */
  live: boolean;
  /** The lot's live status, close, winner and result, as last read or heard. */
  snapshot: LotBidSnapshot;
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
  currentUserId?: string | null;
  children: ReactNode;
};

function hydrateDataToContext(
  data: LotBidHydrateData,
): Omit<LotBidHistoryContextValue, "applyOwnBid" | "setEndedWinner" | "refreshFromServer"> {
  return {
    live: isLiveLotBidHydrate(data),
    snapshot: data.snapshot,
    entries: data.entries,
    currentPrice: data.snapshot.currentPrice,
    leadingBidderId: data.leadingBidderId,
    latestSnapshotReserveMet: data.reserveMet,
  };
}

/**
 * Single source of truth for lot bid history and live price on the marketing page. It takes no
 * server state: the page is built from cached reads, so it starts from a placeholder and the
 * first no-store read (then the socket) fills it.
 */
export function LotBidHistoryProvider({ lotId, currentUserId = null, children }: ProviderProps) {
  const queryClient = useQueryClient();
  const onlineLifecycle = useOnlineLotLifecycle();
  const noticeReporter = useLiveConnectivityNoticeReporterOptional();
  const localOwnBidRef = useRef<OwnBidEchoGuard | null>(null);
  const ownBidEchoGuardRef = onlineLifecycle?.ownBidEchoGuardRef ?? localOwnBidRef;

  const initialHydrate = useMemo(() => pendingLotBidHydrate(), []);

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

  /**
   * The latest close this page has applied, and the server's stamp on what it came from (a read's
   * `asOf`, an event's `changedAt`). A read taken after staff moved the close wins over a cached
   * later close; one from before cannot undo it. Unstamped, a live lot's close only moves later.
   */
  const appliedEndRef = useRef<number | null>(null);
  const appliedAtRef = useRef<number | null>(null);
  const noteEnd = useCallback(
    (
      endMs: number,
      status: LotBidSnapshot["status"],
      opts: {
        source?: "snapshot" | "event";
        extendedUntil?: string | null;
        atMs?: number | null;
      } = {},
    ) => {
      const atMs = opts.atMs ?? null;
      const knownAtMs = appliedAtRef.current;
      if (atMs !== null && (knownAtMs === null || atMs > knownAtMs)) appliedAtRef.current = atMs;
      // The first close the page hears is the close, not an extension. A lot that a late bid had
      // already extended before this page loaded still reads as extended, from the first render.
      if (appliedEndRef.current === null) {
        appliedEndRef.current = endMs;
        if (readsAsExtended(endMs, opts.extendedUntil, status)) {
          onlineLifecycle?.seedExtended(endMs);
        } else {
          onlineLifecycle?.setLiveEndTimeMs(endMs);
        }
        return;
      }
      const newer = heardIsNewer(knownAtMs, atMs, opts.source ?? "snapshot");
      const result = reconcileEnd(appliedEndRef.current, endMs, status, newer);
      appliedEndRef.current = result.endMs;
      if (result.extension) {
        onlineLifecycle?.applyExtension({
          endTimeMs: result.endMs,
          addedMs: result.extension.addedMs,
        });
      } else {
        onlineLifecycle?.setLiveEndTimeMs(result.endMs);
      }
    },
    [onlineLifecycle],
  );

  const applyLifecycleFromSnapshot = useCallback(
    (snapshot: LotBidSnapshot) => {
      noteEnd(new Date(snapshot.endTime).getTime(), snapshot.status, {
        extendedUntil: snapshot.extendedUntil ?? null,
        atMs: snapshot.asOf ? Date.parse(snapshot.asOf) : null,
      });
      if (snapshot.status === "ended") {
        // An ended lot carries its result: the winner comes with the status, so the header
        // never reads a sold lot as "No sale" before a realtime event names the winner.
        onlineLifecycle?.setLiveLotEnded({
          winnerId: snapshot.winnerId ?? null,
          noSale: snapshot.winnerId == null,
        });
      } else {
        onlineLifecycle?.setLiveLotStatus(snapshot.status);
      }
    },
    [onlineLifecycle, noteEnd],
  );

  const live = isLiveLotBidHydrate(hydrateData);
  useEffect(() => {
    // The placeholder is not the lot's state: nothing is applied from it.
    if (!live) return;
    applyLifecycleFromSnapshot(hydrateData.snapshot);
  }, [live, hydrateData.snapshot, applyLifecycleFromSnapshot]);

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

      applyLifecycleFromSnapshot(hydrated.snapshot);
      // The cache keeps the close the page settled on: a read from before a late bid must not
      // move it back, and one taken after staff moved the close forward does.
      const applied = appliedEndRef.current;
      queryClient.setQueryData(
        lotBidKeys.hydrate(lotId),
        applied !== null && applied !== new Date(hydrated.snapshot.endTime).getTime()
          ? { ...hydrated, snapshot: { ...hydrated.snapshot, endTime: new Date(applied) } }
          : hydrated,
      );
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
    onLotExtended: (payload) => {
      const extension = parseLotExtension(payload);
      if (!extension) return;
      if (extension.serverNowMs !== null) {
        browserClockSync().observeServerNow(extension.serverNowMs);
      }
      // A close that did not move is one already applied (the event arrives under two names, back
      // to back, so this reads the ref, not the last render). An earlier one is the staff moving the
      // close forward, and an upcoming lot follows staff either way. Before the first live read the
      // page has no close to move; that read brings it.
      if (appliedEndRef.current === null) return;
      if (extension.endTimeMs === appliedEndRef.current) return;
      const status =
        queryClient.getQueryData<LotBidHydrateData>(lotBidKeys.hydrate(lotId))?.snapshot.status ??
        "active";
      noteEnd(extension.endTimeMs, status, {
        source: "event",
        atMs: extension.changedAtMs ?? null,
      });
      const endMs = appliedEndRef.current;
      patchHydrateCache((prev) => ({
        ...prev,
        snapshot: { ...prev.snapshot, endTime: new Date(endMs) },
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
