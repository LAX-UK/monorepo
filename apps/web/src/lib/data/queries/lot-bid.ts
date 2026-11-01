import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { fetchLotBidHistory } from "@/lib/bid/fetch-lot-bid-history.client";
import { type LotBidSnapshot, fetchLotBidSnapshot } from "@/lib/bid/fetch-lot-bid-snapshot.client";
import { queryOptions } from "@tanstack/react-query";

export type LotBidHydrateData = {
  snapshot: LotBidSnapshot;
  entries: BidHistoryEntry[];
  leadingBidderId: string | null;
  reserveMet: boolean | undefined;
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
 * Seed the live bid cache from the server-rendered lot. The snapshot is the lot as the
 * server loaded it: its real status and closing time, never placeholders, because the
 * lifecycle (open, upcoming, closed) is classified from it before the first resync.
 */
export function buildLotBidInitialHydrate(input: {
  initialSnapshot: LotBidSnapshot;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
}): LotBidHydrateData {
  return {
    snapshot: input.initialSnapshot,
    entries: input.initialHistory,
    leadingBidderId: input.initialLeadingBidderId ?? null,
    reserveMet: input.initialSnapshot.reserveMet,
  };
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
