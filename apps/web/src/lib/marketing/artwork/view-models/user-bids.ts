import type { BidHistoryEntry } from "@/lib/bid/bid-history-entry";
import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import type { Lot } from "@auction/types";
import { maskPaddleFromBidderId } from "./bid-feed";

/** Current user's bid rows for the "Your bids" card (online mockup). */
export type UserBidHistoryRowVM = {
  id: string;
  amount: string;
  status: "highest" | "outbid" | "won";
  isAutoBid?: boolean;
};

export type UserBidsHistoryVM = {
  count: number;
  paddleLabel: string;
  rows: UserBidHistoryRowVM[];
  /** e.g. outbid context: your last bid vs current high. */
  contextLine?: string;
};

/** Pure mapper: newest user bids first; status from global leading bid and lot outcome. */
export function mapUserBidsHistoryVM(
  entries: BidHistoryEntry[],
  userId: string | null,
  lot: Pick<Lot, "status" | "winnerId"> & { marketingDetails?: Lot["marketingDetails"] },
): UserBidsHistoryVM | null {
  if (!userId || entries.length === 0) return null;
  const userBids = entries.filter((e) => e.bidderId === userId);
  if (userBids.length === 0) return null;
  const currency = resolveLotCurrency(lot);

  const sortedByAmount = [...entries].sort((a, b) => {
    const na = Number.parseFloat(a.amount);
    const nb = Number.parseFloat(b.amount);
    if (nb !== na) return nb - na;
    return b.at - a.at;
  });
  const top = sortedByAmount[0];
  if (!top) return null;

  const rows: UserBidHistoryRowVM[] = [...userBids]
    .sort((a, b) => b.at - a.at)
    .map((e) => {
      const isLeadingBid = e.id === top.id && e.bidderId === top.bidderId;
      let status: UserBidHistoryRowVM["status"] = "outbid";
      if (isLeadingBid) {
        const userWon = lot.status === "ended" && lot.winnerId === userId;
        status = userWon ? "won" : "highest";
      }
      return {
        id: e.id,
        amount: formatMoney(e.amount, currency),
        status,
        ...(e.isAutoBid && isLeadingBid ? { isAutoBid: true } : {}),
      };
    });

  return {
    count: userBids.length,
    paddleLabel: maskPaddleFromBidderId(userId),
    rows,
  };
}
