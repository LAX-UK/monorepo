import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { prependBidHistoryEntry } from "@/components/sections/artwork/bid-history-utils";
import { LOT_BID_HISTORY_CAP } from "@/lib/bid/lot-bid-history-constants";
import type { BidUpdateEvent } from "@auction/types";

export type LotBidHistoryState = {
  entries: BidHistoryEntry[];
  currentPrice: string;
  leadingBidderId: string | null;
};

export type OwnBidInput = {
  id: string;
  amount: string;
  bidderId?: string | null;
  placedByUserId?: string | null;
  isAutoBid?: boolean;
  placedVia?: string | null;
};

function capHistory(entries: BidHistoryEntry[]): BidHistoryEntry[] {
  return entries.slice(0, LOT_BID_HISTORY_CAP);
}

export function reduceOnBidUpdate(
  state: LotBidHistoryState,
  event: BidUpdateEvent,
  opts?: { skipPriceLeader?: boolean },
): LotBidHistoryState {
  const entry: Omit<BidHistoryEntry, "at"> & { at?: number } = {
    id: event.bidId,
    bidderId: event.bidderId,
    amount: event.amount,
    ...(event.isAutoBid ? { isAutoBid: true } : {}),
    ...(event.placedVia ? { placedVia: event.placedVia } : {}),
  };

  const next: LotBidHistoryState = {
    ...state,
    entries: capHistory(prependBidHistoryEntry(state.entries, entry)),
  };

  if (opts?.skipPriceLeader) {
    return next;
  }

  return {
    ...next,
    currentPrice: event.currentPrice,
    leadingBidderId: event.bidderId,
  };
}

export function reduceOnOwnBid(state: LotBidHistoryState, bid: OwnBidInput): LotBidHistoryState {
  const bidderId = bid.bidderId ?? bid.placedByUserId ?? "";
  return {
    entries: capHistory(
      prependBidHistoryEntry(state.entries, {
        id: bid.id,
        bidderId,
        amount: bid.amount,
        ...(bid.isAutoBid ? { isAutoBid: true } : {}),
        ...(bid.placedVia ? { placedVia: bid.placedVia } : {}),
      }),
    ),
    currentPrice: bid.amount,
    leadingBidderId: bidderId || null,
  };
}

export function reduceOnHydrate(
  _state: LotBidHistoryState,
  snapshot: {
    currentPrice: string;
    leadingBidderId: string | null;
    entries: BidHistoryEntry[];
  },
): LotBidHistoryState {
  return {
    currentPrice: snapshot.currentPrice,
    leadingBidderId: snapshot.leadingBidderId,
    entries: capHistory(snapshot.entries),
  };
}
