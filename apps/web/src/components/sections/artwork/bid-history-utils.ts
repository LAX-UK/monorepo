import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";

/** Prepend a bid row and dedupe by id (newest first). */
export function prependBidHistoryEntry(
  prev: BidHistoryEntry[],
  entry: Omit<BidHistoryEntry, "at"> & { at?: number },
): BidHistoryEntry[] {
  const next: BidHistoryEntry = { ...entry, at: entry.at ?? Date.now() };
  return [next, ...prev].filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i);
}
