import { type BidPlacement, getBidPlacement } from "@/lib/bid/bid-placement-presenter";
import type { Bid, Lot } from "@auction/types";

export const bidTabs = ["active", "won", "lost"] as const;
export type BidTab = (typeof bidTabs)[number];

export function parseBidTab(raw: string | null | undefined, fallback: BidTab = "active"): BidTab {
  if (raw && (bidTabs as readonly string[]).includes(raw)) return raw as BidTab;
  return fallback;
}

export type BidBoardRow = {
  bid: Bid;
  lot: Lot | null;
  statusLabel: string;
  statusClassName: string;
  outbid: boolean;
  timeLeft: string;
  placement: BidPlacement;
};

function boardRowPlacement(bid: Bid): BidPlacement {
  return getBidPlacement(bid);
}

export function formatRemaining(endMs: number, now: number): string {
  const ms = endMs - now;
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function buildBidBoardRows(
  unique: { bid: Bid; lot: Lot | null }[],
  userId: string | undefined,
  now: number,
): { active: BidBoardRow[]; won: BidBoardRow[]; lost: BidBoardRow[] } {
  const active: BidBoardRow[] = [];
  const won: BidBoardRow[] = [];
  const lost: BidBoardRow[] = [];

  for (const row of unique) {
    const a = row.lot;

    if (!a) {
      lost.push({
        bid: row.bid,
        lot: null,
        statusLabel: "Unknown",
        statusClassName: "text-secondary",
        outbid: false,
        timeLeft: "—",
        placement: boardRowPlacement(row.bid),
      });
      continue;
    }

    if (a.status === "ended") {
      const didWin = Boolean(userId && a.winnerId === userId);
      if (didWin) {
        won.push({
          bid: row.bid,
          lot: a,
          statusLabel: "Won",
          statusClassName: "text-primary",
          outbid: false,
          timeLeft: "—",
          placement: boardRowPlacement(row.bid),
        });
      } else {
        lost.push({
          bid: row.bid,
          lot: a,
          statusLabel: "Closed",
          statusClassName: "text-secondary",
          outbid: false,
          timeLeft: "—",
          placement: boardRowPlacement(row.bid),
        });
      }
      continue;
    }

    if (a.status === "active") {
      const myAmount = Number.parseFloat(row.bid.amount);
      const high = Number.parseFloat(a.currentPrice);
      const winning = row.bid.isWinning && Math.abs(myAmount - high) < 0.02;
      const statusLabel = winning ? "Winning" : "Outbid";
      const statusClassName = winning ? "text-primary" : "text-error";
      const timeLeft = formatRemaining(a.endTime.getTime(), now);
      active.push({
        bid: row.bid,
        lot: a,
        statusLabel,
        statusClassName,
        outbid: !winning,
        timeLeft,
        placement: boardRowPlacement(row.bid),
      });
      continue;
    }

    lost.push({
      bid: row.bid,
      lot: a,
      statusLabel: a.status,
      statusClassName: "text-secondary",
      outbid: false,
      timeLeft: "—",
      placement: boardRowPlacement(row.bid),
    });
  }

  return { active, won, lost };
}
