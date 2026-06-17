import { formatBidChannelLabel } from "@/lib/bid/bid-channel-label";
import { PLATFORM_DEFAULT_CURRENCY } from "@/lib/money/currency";
import { formatMoney } from "@/lib/ui/format";
import type {
  BidUpdateEvent,
  SaleroomDisplayLotEstimate,
  SaleroomDisplaySnapshot,
} from "@auction/types";

export type DisplayBidTick = {
  id: string;
  amount: string;
  placedVia: string | null;
  isAutoBid: boolean;
  at: number;
};

export type DisplayBidLiveState = {
  recentBids: DisplayBidTick[];
  priceFlash: boolean;
  leaderPlacedVia: string | null;
};

export type DisplayLastHammer = {
  price: string;
  paddleLabel: string | null;
};

export type DisplayBoardVM = {
  snapshot: SaleroomDisplaySnapshot;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  recentBids: DisplayBidTick[];
  priceFlash: boolean;
  leaderLabel: string | null;
  nextRequiredBid: string | null;
  nextRequiredBidCurrency: string;
};

export const DISPLAY_BID_TICK_CAP = 5;

const CHANNEL_FIRST_PLACED_VIA = new Set(["web", "telephone", "absentee"]);

export const EMPTY_DISPLAY_BID_LIVE_STATE: DisplayBidLiveState = {
  recentBids: [],
  priceFlash: false,
  leaderPlacedVia: null,
};

export function resetDisplayBidLiveState(): DisplayBidLiveState {
  return { ...EMPTY_DISPLAY_BID_LIVE_STATE };
}

export function formatDisplayLeaderLabel(
  placedVia: string | null,
  paddleNumber: number | null,
): string | null {
  const channel = formatBidChannelLabel(placedVia);
  if (placedVia && CHANNEL_FIRST_PLACED_VIA.has(placedVia)) {
    return channel;
  }
  if (placedVia === "saleroom") {
    if (paddleNumber != null) {
      return `Paddle ${paddleNumber}`;
    }
    return channel ?? "Floor";
  }
  if (paddleNumber != null) {
    return `Paddle ${paddleNumber}`;
  }
  return channel;
}

export function formatDisplayBidRowLabel(
  placedVia: string | null,
  paddleNumber: number | null,
): string {
  return formatDisplayLeaderLabel(placedVia, paddleNumber) ?? "Bidder";
}

export function formatDisplayEstimate(
  estimate: SaleroomDisplayLotEstimate | null | undefined,
): string | null {
  if (!estimate) {
    return null;
  }
  return `${formatMoney(estimate.low, estimate.currency)} – ${formatMoney(estimate.high, estimate.currency)}`;
}

export function computeNextRequiredBid(
  currentPrice: string,
  minBidIncrement: string,
): string | null {
  const current = Number.parseFloat(currentPrice);
  const increment = Number.parseFloat(minBidIncrement);
  if (!Number.isFinite(current) || !Number.isFinite(increment)) {
    return null;
  }
  return (current + increment).toFixed(2);
}

export function defaultDisplayBidCurrency(
  estimate: SaleroomDisplayLotEstimate | null | undefined,
): string {
  return estimate?.currency ?? PLATFORM_DEFAULT_CURRENCY;
}

function tickFromEvent(event: BidUpdateEvent): DisplayBidTick {
  return {
    id: event.bidId,
    amount: event.amount,
    placedVia: event.placedVia ?? null,
    isAutoBid: event.isAutoBid === true,
    at: event.emittedAt ?? Date.now(),
  };
}

function prependTick(ticks: DisplayBidTick[], tick: DisplayBidTick, cap: number): DisplayBidTick[] {
  const withoutDup = ticks.filter((entry) => entry.id !== tick.id);
  return [tick, ...withoutDup].slice(0, cap);
}

export function applyDisplayBidUpdate(
  state: DisplayBidLiveState,
  event: BidUpdateEvent,
  opts: { lotId: string; cap?: number; suppressFlash?: boolean },
): DisplayBidLiveState {
  if (event.lotId !== opts.lotId) {
    return state;
  }

  const cap = opts.cap ?? DISPLAY_BID_TICK_CAP;
  const tick = tickFromEvent(event);

  return {
    recentBids: prependTick(state.recentBids, tick, cap),
    priceFlash: opts.suppressFlash ? state.priceFlash : true,
    leaderPlacedVia: event.placedVia ?? null,
  };
}

export function mergeSnapshotAfterHydrate(
  bidLive: DisplayBidLiveState,
  previousLotId: string | null,
  nextLotId: string | null,
): DisplayBidLiveState {
  if (previousLotId === nextLotId) {
    return bidLive;
  }
  return resetDisplayBidLiveState();
}

export function applyDisplayBidSummaryToSnapshot(
  snapshot: SaleroomDisplaySnapshot,
  summary: {
    lotId: string;
    currentPrice: string;
    bidCount: number;
    leaderPaddleNumber: number | null;
  },
): SaleroomDisplaySnapshot {
  if (!snapshot.currentLot || snapshot.currentLot.id !== summary.lotId) {
    return snapshot;
  }
  return {
    ...snapshot,
    currentLot: {
      ...snapshot.currentLot,
      currentPrice: summary.currentPrice,
      bidCount: summary.bidCount,
      leaderPaddleNumber: summary.leaderPaddleNumber,
    },
  };
}

/** Prefer live display-channel bid summary when a stale HTTP snapshot completes later. */
export function resolveBidSummaryAfterFullHydrate(
  liveSnapshot: SaleroomDisplaySnapshot | null,
  fromSnapshot: SaleroomDisplaySnapshot,
  wsBidSummaryEmittedAt: string | null,
): SaleroomDisplaySnapshot {
  if (!wsBidSummaryEmittedAt || !liveSnapshot?.currentLot || !fromSnapshot.currentLot) {
    return fromSnapshot;
  }
  if (liveSnapshot.currentLot.id !== fromSnapshot.currentLot.id) {
    return fromSnapshot;
  }
  const livePrice = Number.parseFloat(liveSnapshot.currentLot.currentPrice);
  const snapshotPrice = Number.parseFloat(fromSnapshot.currentLot.currentPrice);
  if (Number.isFinite(livePrice) && livePrice >= snapshotPrice) {
    return {
      ...fromSnapshot,
      currentLot: {
        ...fromSnapshot.currentLot,
        currentPrice: liveSnapshot.currentLot.currentPrice,
        bidCount: Math.max(liveSnapshot.currentLot.bidCount, fromSnapshot.currentLot.bidCount),
        leaderPaddleNumber: liveSnapshot.currentLot.leaderPaddleNumber,
      },
    };
  }
  return fromSnapshot;
}

export function buildDisplayBoardVM(
  snapshot: SaleroomDisplaySnapshot,
  bidLive: DisplayBidLiveState,
  connectionStatus: DisplayBoardVM["connectionStatus"],
  opts?: { suppressPriceFlash?: boolean },
): DisplayBoardVM {
  const lot = snapshot.currentLot;
  const leaderLabel =
    lot && lot.bidCount > 0
      ? formatDisplayLeaderLabel(bidLive.leaderPlacedVia, lot.leaderPaddleNumber)
      : null;
  const nextRequiredBidCurrency = defaultDisplayBidCurrency(lot?.estimate);
  const nextRequiredBid =
    lot != null ? computeNextRequiredBid(lot.currentPrice, lot.minBidIncrement ?? "1.00") : null;

  return {
    snapshot,
    connectionStatus,
    recentBids: bidLive.recentBids,
    priceFlash: opts?.suppressPriceFlash ? false : bidLive.priceFlash,
    leaderLabel,
    nextRequiredBid,
    nextRequiredBidCurrency,
  };
}
