import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { mapBidToHistoryEntry } from "@/lib/bid/map-bid-to-history-entry";
import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseBid } from "@/lib/data/http/parse";

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
