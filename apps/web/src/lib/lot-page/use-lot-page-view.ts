"use client";

import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import {
  type LotPageView,
  type LotPageViewInput,
  buildLotPageView,
} from "@/lib/lot-page/build-lot-page-view";
import type { LotViewerView } from "@/lib/lot-page/lot-viewer";
import { useLotPageNow } from "@/lib/lot-page/use-lot-page-now";
import { useLotPublicHistory, useLotViewer } from "@/lib/lot-page/use-lot-reads";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { type PublicBidHistory, lotLifecycleCopy, nextBidAmount } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { useMemo } from "react";

type SalePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

/**
 * The lot as the server loaded it: its catalogue facts only. The page is built from cached reads
 * (CO-7), so nothing that bidding moves is here (price, status, close, winner, result, reserve
 * met): those come from the live read and the socket (`useLotBidHistory`).
 */
export type LotPageLot = Pick<
  Lot,
  "id" | "auctionType" | "startingPrice" | "minBidIncrement" | "marketingDetails"
> & {
  startTime: string;
  /** From the public view: whether a reserve is set. Whether bidding met it is live. */
  hasReserve?: boolean | undefined;
  /** The zone of the lot's sale, which its times are quoted in. */
  timeZone?: string | undefined;
};

export type LotPageViewSource = {
  lot: LotPageLot;
  sale: SalePick;
  signedIn: boolean;
  initialViewer: LotViewerView | null;
};

function reserveOf(lot: LotPageLot, reserveMet: boolean | undefined): LotPageViewInput["reserve"] {
  if (!lot.hasReserve) return "none";
  return reserveMet === true ? "met" : "below";
}

/** The ISO time of an instant given in ms, or `null` when it isn't a real one. */
function isoOf(ms: number | null): string | null {
  return ms !== null && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * The lot page's view model, kept live: the lot's own times and price, the room's session, the
 * server's clock and the viewer's standing, composed by the domain into one `LotPageView`. The
 * components draw it and decide nothing.
 */
export type LotPageLive = {
  /**
   * False until the first live read lands. Until then `view` is built from a placeholder and must
   * not be drawn: the parts that show bid state draw placeholders, no clock runs and bidding is
   * shut.
   */
  live: boolean;
  view: LotPageView;
  history: PublicBidHistory | null;
  nowMs: number;
  /** The lot's price now, kept live: the figure the next bid and the valid amounts follow. */
  currentPrice: string;
  /** The next valid bid while bidding is open. */
  nextBid: string | null;
  /** Where the acting account stands on the lot. */
  viewer: LotViewerView;
};

export function useLotPageView(source: LotPageViewSource): LotPageLive {
  const { lot, sale, signedIn } = source;
  const online = useOnlineLotLifecycle();
  const saleroom = useSaleroomLive();
  const { live, snapshot, currentPrice, entries, latestSnapshotReserveMet } = useLotBidHistory();
  const status = online?.liveLotStatus ?? snapshot.status;
  const winnerId = online?.liveWinnerId ?? snapshot.winnerId;
  const endMs = online?.liveEndTimeMs ?? new Date(snapshot.endTime).getTime();
  const startMs = Date.parse(lot.startTime);
  const extendedByMs = online?.extendedByMs ?? null;
  const seededExtended = online?.seededExtended ?? false;
  const onBlock = saleroom?.isLotOnBlock(lot.id) ?? false;
  const nowMs = useLotPageNow(snapshot.serverNow ?? null, [startMs, endMs]);
  const hasWinner = snapshot.hasWinner;
  const resultPending = snapshot.resultPending;

  const lifecycle = useMemo(
    () =>
      classifyLotLifecycle(
        {
          id: lot.id,
          status,
          startTime: new Date(startMs),
          endTime: new Date(endMs),
          winnerId,
          currentPrice,
          hasWinner,
          resultPending,
        },
        sale,
        nowMs,
        {
          recentlyExtended: Boolean(extendedByMs && extendedByMs > 0) || seededExtended,
          confirmClose: true,
          saleroomSessionPaused: saleroom?.status === "paused",
          saleroomSessionActive: saleroom?.isSessionLive ?? false,
          isOnBlock: onBlock,
        },
      ),
    [
      lot.id,
      hasWinner,
      resultPending,
      status,
      startMs,
      endMs,
      winnerId,
      currentPrice,
      sale,
      nowMs,
      extendedByMs,
      seededExtended,
      saleroom?.status,
      saleroom?.isSessionLive,
      onBlock,
    ],
  );

  // Anything that moves the lot moves the viewer's standing and the history with it.
  const revision = `${currentPrice}:${lifecycle.kind}:${entries.length}`;
  const viewer = useLotViewer({
    lotId: lot.id,
    signedIn,
    revision,
    initial: source.initialViewer,
  });
  const history = useLotPublicHistory({
    lotId: lot.id,
    enabled:
      live && (lotLifecycleCopy(lifecycle.kind).biddingOpen || lifecycle.kind.startsWith("ended")),
    revision,
  });

  const nextBid =
    live && lotLifecycleCopy(lifecycle.kind).biddingOpen
      ? nextBidAmount({
          auctionType: lot.auctionType,
          currentPrice,
          startingPrice: lot.startingPrice,
          minBidIncrement: lot.minBidIncrement,
        })
      : null;
  const estimate = lot.marketingDetails.estimate;

  const view = useMemo(
    () =>
      buildLotPageView({
        lifecycle: lifecycle.kind,
        now: new Date(nowMs),
        msLeft: lifecycle.msLeft,
        startsAt: isoOf(startMs),
        endsAt: isoOf(endMs),
        ...(lot.timeZone ? { timeZone: lot.timeZone } : {}),
        amounts: {
          starting: lot.startingPrice,
          current: currentPrice,
          hammer: snapshot.hammerPrice ?? null,
          soldForWithPremium: snapshot.soldForWithPremium ?? null,
        },
        estimate: estimate ? { low: estimate.low, high: estimate.high } : null,
        bidCount: history?.total ?? entries.length,
        reserve: reserveOf(lot, latestSnapshotReserveMet),
        nextBid,
        extendedByMs,
        extensions: online?.extensionCount ?? 0,
        saleroom: lifecycle.kind === "liveSaleroom" ? { onBlock, lotsAway: null } : null,
        signedIn,
        viewer,
      }),
    [
      lifecycle,
      nowMs,
      startMs,
      endMs,
      lot,
      currentPrice,
      snapshot.hammerPrice,
      snapshot.soldForWithPremium,
      latestSnapshotReserveMet,
      estimate,
      history?.total,
      entries.length,
      nextBid,
      extendedByMs,
      online?.extensionCount,
      onBlock,
      signedIn,
      viewer,
    ],
  );
  return { live, view, history: live ? history : null, nowMs, currentPrice, nextBid, viewer };
}
