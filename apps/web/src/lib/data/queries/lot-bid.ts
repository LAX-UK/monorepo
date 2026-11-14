import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { fetchLotBidHistory } from "@/lib/bid/fetch-lot-bid-history.client";
import { type LotBidSnapshot, fetchLotBidSnapshot } from "@/lib/bid/fetch-lot-bid-snapshot.client";
import { queryOptions } from "@tanstack/react-query";

export type LotBidHydrateData = {
  snapshot: LotBidSnapshot;
  entries: BidHistoryEntry[];
  leadingBidderId: string | null;
  reserveMet: boolean | undefined;
  /**
   * Set only on the placeholder the page starts from: nothing in it is the lot's real state. It
   * goes away with the first live read, which replaces the whole value; socket patches keep it.
   */
  pending?: true;
};

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

/** Fetch lot snapshot + bid history via existing browser RPC adapters (DIP). */
export async function fetchLotBidHydrate(lotId: string): Promise<LotBidHydrateData | null> {
  const [lotSnap, bidEntries] = await Promise.all([
    fetchLotBidSnapshot(lotId),
    fetchLotBidHistory(lotId),
  ]);
  if (!lotSnap || !bidEntries) return null;

  const leadingBidderId =
    lotSnap.status === "ended"
      ? (lotSnap.winnerId ?? deriveLeadingBidderId(bidEntries))
      : deriveLeadingBidderId(bidEntries);

  return {
    snapshot: lotSnap,
    entries: bidEntries,
    leadingBidderId,
    reserveMet: lotSnap.reserveMet,
  };
}

/**
 * What the lot page starts from (CO-7): no price, no status, no close, no history and no leader.
 * The page HTML is built from cached reads, so it carries none of the live bid state; the panel
 * draws placeholders and keeps bidding shut until the first no-store read replaces this.
 */
export function pendingLotBidHydrate(): LotBidHydrateData {
  return {
    snapshot: { currentPrice: "0", endTime: new Date(0), status: "scheduled", winnerId: null },
    entries: [],
    leadingBidderId: null,
    reserveMet: undefined,
    pending: true,
  };
}

/** Whether the value came from a live read (or the socket after one), not the placeholder. */
export function isLiveLotBidHydrate(data: LotBidHydrateData): boolean {
  return data.pending !== true;
}

export const lotBidKeys = {
  all: ["lot-bid"] as const,
  hydrate: (lotId: string) => [...lotBidKeys.all, "hydrate", lotId] as const,
};

export function lotBidHydrateQueryOptions(lotId: string) {
  return queryOptions({
    queryKey: lotBidKeys.hydrate(lotId),
    queryFn: () => fetchLotBidHydrate(lotId),
    enabled: Boolean(lotId),
  });
}
