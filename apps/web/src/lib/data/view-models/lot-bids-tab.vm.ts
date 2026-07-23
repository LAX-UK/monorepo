import { formatMoney } from "@/lib/ui/format";
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

export function buildLotBidsKpiTiles(rows: readonly LotBidTableRow[]): {
  id: string;
  label: string;
  value: string;
  compareHint?: string;
}[] {
  const winning = rows.find((b) => b.isWinning);
  const autoCount = rows.filter((b) => b.isAutoBid).length;
  return [
    { id: "total", label: "Total bids", value: String(rows.length), compareHint: "On this lot" },
    {
      id: "winning",
      label: "Winning bid",
      value: winning ? formatMoney(winning.amount) : "—",
      compareHint: winning ? "Current leader" : "No bids yet",
    },
    {
      id: "auto",
      label: "Auto bids",
      value: String(autoCount),
      compareHint: "Proxy ceilings active",
    },
  ];
}
