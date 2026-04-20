import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";

export type LotPriceDisplay = {
  label: string;
  value: string;
};

function toNum(amount: string): number {
  const n = Number.parseFloat(amount);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Human-readable price label + formatted value for marketing cards,
 * derived from lot status, auction type, and price fields (no separate estimate range on Lot).
 */
export function lotPriceDisplay(lot: Lot): LotPriceDisplay {
  if (lot.status === "cancelled") {
    return { label: "Withdrawn", value: "—" };
  }

  if (lot.status === "ended") {
    if (lot.winnerId) {
      return { label: "Sold for", value: formatMoney(lot.currentPrice) };
    }
    return { label: "Unsold", value: "—" };
  }

  if (lot.auctionType === "buy_it_now" && lot.buyNowPrice) {
    return { label: "Buy now", value: formatMoney(lot.buyNowPrice) };
  }

  if (lot.auctionType === "dutch" && lot.status === "active") {
    return { label: "Current price", value: formatMoney(lot.currentPrice) };
  }

  if (lot.auctionType === "english" || lot.auctionType === "sealed") {
    const start = toNum(lot.startingPrice);
    const current = toNum(lot.currentPrice);
    if (lot.status === "active" && current > start) {
      return { label: "Current bid", value: formatMoney(lot.currentPrice) };
    }
    return { label: "Starting bid", value: formatMoney(lot.startingPrice) };
  }

  return { label: "Starting bid", value: formatMoney(lot.startingPrice) };
}
