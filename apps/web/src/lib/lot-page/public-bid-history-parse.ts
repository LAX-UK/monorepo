import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { PublicBidChannel, PublicBidHistory, PublicBidHistoryEntry } from "@auction/domain";

/** Bids the lot page fetches: three show collapsed, the rest sit behind "See all". */
export const LOT_HISTORY_LIMIT = 20;

const CHANNELS: readonly PublicBidChannel[] = ["online", "room", "phone"];

function parseEntry(raw: unknown): PublicBidHistoryEntry | null {
  if (!isIndexableObject(raw)) return null;
  if (typeof raw.amount !== "string" || typeof raw.placedAt !== "string") return null;
  const channel = CHANNELS.find((c) => c === raw.channel) ?? "online";
  return {
    amount: raw.amount,
    channel,
    placedAt: raw.placedAt,
    isViewer: raw.isViewer === true,
  };
}

export function parsePublicBidHistory(raw: unknown): PublicBidHistory | null {
  if (!isIndexableObject(raw) || !Array.isArray(raw.entries)) return null;
  const entries = raw.entries.flatMap((row) => {
    const entry = parseEntry(row);
    return entry ? [entry] : [];
  });
  const total =
    typeof raw.total === "number" ? Math.max(raw.total, entries.length) : entries.length;
  return { entries, total };
}
