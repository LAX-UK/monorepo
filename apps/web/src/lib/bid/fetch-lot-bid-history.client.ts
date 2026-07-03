import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { mapBidToHistoryEntry } from "@/lib/bid/map-bid-to-history-entry";
import { browserApiBase, browserFetch, getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseBid } from "@/lib/data/http/parse";

export type LotBidHistoryRow = {
  id: string;
  amount: string;
  createdAt: string;
  placedByUserId: string | null;
  bidderRef?: string;
};

/** Full bid rows for dashboard drawer (includes ownership fields). */
export async function fetchLotBidHistoryRows(
  lotId: string,
  limit = 200,
): Promise<LotBidHistoryRow[] | null> {
  try {
    const res = await browserFetch(
      `${browserApiBase()}/lots/${encodeURIComponent(lotId)}/bids?limit=${limit}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data: LotBidHistoryRow[] };
    return body.data;
  } catch {
    return null;
  }
}

/** Refetch public bid history after websocket reconnect (stale feed guard). */
export async function fetchLotBidHistory(
  lotId: string,
  limit = 30,
): Promise<BidHistoryEntry[] | null> {
  try {
    const res = await getBrowserHc().lots[":id"].bids.$get({
      param: { id: lotId },
      query: { limit: String(limit) },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: unknown[] };
    return body.data.map((row) => mapBidToHistoryEntry(parseBid(row)));
  } catch {
    return null;
  }
}
