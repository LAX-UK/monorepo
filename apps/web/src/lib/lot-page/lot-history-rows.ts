import type { PublicBidChannel, PublicBidHistory } from "@auction/domain";
import { formatLotMoney } from "./lot-money";

/** How many bids show before "See all". */
export const HISTORY_PREVIEW_COUNT = 3;

export type LotHistoryRow = {
  /** Stable across polls: position from the oldest bid, so rows keep their keys as new ones arrive. */
  key: string;
  amount: string;
  /** "You" for the viewer's own bid; every other bidder stays anonymous. */
  isViewer: boolean;
  /** "Online · 2 min ago". */
  detail: string;
};

export type LotHistoryView = {
  /** "6 bids", or "No bids yet". */
  summary: string;
  rows: LotHistoryRow[];
  /** Rows past the preview, behind "See all". */
  hiddenCount: number;
};

const CHANNEL_LABEL: Readonly<Record<PublicBidChannel, string>> = {
  online: "Online",
  room: "In the room",
  phone: "Phone",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "2 min ago", "1 h ago", "3 days ago". */
export function relativeBidTime(placedAtIso: string, nowMs: number): string {
  const elapsed = Math.max(0, nowMs - Date.parse(placedAtIso));
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  const days = Math.floor(elapsed / DAY);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function summaryOf(total: number): string {
  if (total === 0) return "No bids yet";
  return `${total} ${total === 1 ? "bid" : "bids"}`;
}

/**
 * The history disclosure's content: the bids newest first, anonymised, with the viewer's own
 * marked. `expanded` shows every fetched bid; collapsed shows the last three.
 */
export function buildLotHistoryView(
  history: PublicBidHistory | null,
  nowMs: number,
  expanded: boolean,
): LotHistoryView {
  const entries = history?.entries ?? [];
  const total = history?.total ?? 0;
  const shown = expanded ? entries : entries.slice(0, HISTORY_PREVIEW_COUNT);
  return {
    summary: summaryOf(total),
    rows: shown.map((entry, index) => ({
      key: `${entries.length - index}`,
      amount: formatLotMoney(entry.amount),
      isViewer: entry.isViewer,
      detail: `${CHANNEL_LABEL[entry.channel]} · ${relativeBidTime(entry.placedAt, nowMs)}`,
    })),
    hiddenCount: Math.max(0, total - shown.length),
  };
}
