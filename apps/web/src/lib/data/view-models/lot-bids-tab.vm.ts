import type { Bid } from "@auction/types";
import { toRequiredIsoString } from "@auction/validators";

export type LotBidTableRow = {
  id: string;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
  autoBidStepAmount: string | null;
  bidderId: string | null;
  bidderLabel: string;
  placedAtIso: string;
};

export function buildLotBidsTableRows(
  bids: readonly Bid[],
  bidderLabels: Readonly<Record<string, string>>,
): LotBidTableRow[] {
  return bids.map((bid) => ({
    id: bid.id,
    amount: bid.amount,
    isWinning: bid.isWinning,
    isAutoBid: bid.isAutoBid,
    maxAutoBidAmount: bid.maxAutoBidAmount,
    autoBidStepAmount: bid.autoBidStepAmount ?? null,
    bidderId: bid.bidderId ?? null,
    bidderLabel: bid.bidderId
      ? (bidderLabels[bid.bidderId] ?? `${bid.bidderId.slice(0, 8)}…`)
      : "—",
    placedAtIso: toRequiredIsoString(bid.createdAt),
  }));
}
