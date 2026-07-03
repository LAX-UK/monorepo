import { formatBidChannelLabel } from "@/lib/bid/bid-channel-label";
import type { BidHistoryEntry } from "@/lib/bid/bid-history-entry";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";

/** Live / onsite bid feed row (paddle anonymized in UI). */
export type BidFeedEntryVM = {
  id: string;
  paddleNumber: string;
  amount: string;
  rank: number;
  isHighest: boolean;
  isYourBid: boolean;
  timestamp: number;
  isAutoBid?: boolean;
  channelLabel?: string | null;
};

export function maskPaddleFromBidderId(bidderId: string): string {
  const tail = bidderId.replace(/-/g, "").slice(-4).toUpperCase();
  return tail ? `Paddle#•••${tail}` : "Paddle#—";
}

/** Map bid history to feed rows: highest amount first, stable tie-breaker by recency. */
export function mapBidHistoryToFeedEntries(
  entries: BidHistoryEntry[],
  currentUserId: string | null,
  currency = PLATFORM_DEFAULT_CURRENCY,
): BidFeedEntryVM[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => {
    const na = Number.parseFloat(a.amount);
    const nb = Number.parseFloat(b.amount);
    if (nb !== na) return nb - na;
    return b.at - a.at;
  });
  return sorted.map((e, i) => ({
    id: e.id,
    paddleNumber: maskPaddleFromBidderId(e.bidderId),
    amount: formatMoney(e.amount, currency),
    rank: i + 1,
    isHighest: i === 0,
    isYourBid: Boolean(currentUserId && e.bidderId === currentUserId),
    timestamp: e.at,
    ...(e.isAutoBid ? { isAutoBid: true } : {}),
    ...(e.placedVia ? { channelLabel: formatBidChannelLabel(e.placedVia) } : {}),
  }));
}
