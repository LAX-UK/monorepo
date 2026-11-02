"use client";

import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import {
  type LotPageView,
  type LotPageViewInput,
  buildLotPageView,
} from "@/lib/lot-page/build-lot-page-view";
import type { LotBiddingView } from "@/lib/lot-page/lot-bidding-view";
import type { LotViewerView } from "@/lib/lot-page/lot-viewer";
import { useLotPublicHistory, useLotViewer } from "@/lib/lot-page/use-lot-reads";
import { useServerClock } from "@/lib/lot-page/use-server-clock";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { type PublicBidHistory, lotLifecycleCopy, nextBidAmount } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { useMemo } from "react";

type SalePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

/** The lot as the server loaded it: what the page needs to decide, nothing it can't serialise. */
export type LotPageLot = Pick<
  Lot,
  | "id"
  | "status"
  | "auctionType"
  | "startingPrice"
  | "currentPrice"
  | "minBidIncrement"
  | "winnerId"
  | "marketingDetails"
> & {
  hasWinner?: boolean | undefined;
  startTime: string;
  endTime: string;
  /** From the public view: whether a reserve is set, and whether the bidding has met it. */
  hasReserve?: boolean | undefined;
  reserveMet?: boolean | null | undefined;
};

export type LotPageViewSource = {
  lot: LotPageLot;
  bidding: LotBiddingView;
  sale: SalePick;
  signedIn: boolean;
  initialViewer: LotViewerView | null;
  initialHistory: PublicBidHistory | null;
};

function reserveOf(lot: LotPageLot): LotPageViewInput["reserve"] {
  if (!lot.hasReserve) return "none";
  return lot.reserveMet === true ? "met" : "below";
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
  const { lot, bidding, sale, signedIn } = source;
  const online = useOnlineLotLifecycle();
  const saleroom = useSaleroomLive();
  const { currentPrice, entries } = useLotBidHistory();
  const nowMs = useServerClock(bidding.serverNow);

  const status = online?.liveLotStatus ?? lot.status;
  const winnerId = online?.liveWinnerId ?? lot.winnerId;
  const endMs = online?.liveEndTimeMs ?? Date.parse(lot.endTime);
  const startMs = Date.parse(lot.startTime);
  const extendedByMs = online?.extendedByMs ?? null;
  const onBlock = saleroom?.isLotOnBlock(lot.id) ?? false;

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
          hasWinner: lot.hasWinner,
        },
        sale,
        nowMs,
        {
          recentlyExtended: Boolean(extendedByMs && extendedByMs > 0),
          saleroomSessionPaused: saleroom?.status === "paused",
          saleroomSessionActive: saleroom?.isSessionLive ?? false,
          isOnBlock: onBlock,
        },
      ),
    [
      lot.id,
      lot.hasWinner,
      status,
      startMs,
      endMs,
      winnerId,
      currentPrice,
      sale,
      nowMs,
      extendedByMs,
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
    enabled: lotLifecycleCopy(lifecycle.kind).biddingOpen || lifecycle.kind.startsWith("ended"),
    revision,
    initial: source.initialHistory,
  });

  const nextBid = lotLifecycleCopy(lifecycle.kind).biddingOpen
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
        amounts: {
          starting: lot.startingPrice,
          current: currentPrice,
          hammer: bidding.hammerPrice,
          soldForWithPremium: bidding.soldForWithPremium,
        },
        estimate: estimate ? { low: estimate.low, high: estimate.high } : null,
        bidCount: history?.total ?? entries.length,
        reserve: reserveOf(lot),
        nextBid,
        extendedByMs,
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
      bidding.hammerPrice,
      bidding.soldForWithPremium,
      estimate,
      history?.total,
      entries.length,
      nextBid,
      extendedByMs,
      onBlock,
      signedIn,
      viewer,
    ],
  );
  return { view, history, nowMs, currentPrice, nextBid, viewer };
}
