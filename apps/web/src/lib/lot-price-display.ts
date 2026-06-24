import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import type { Lot } from "@auction/types";

export type LotPriceDisplay = {
  label: string;
  value: string;
};

function toNum(amount: string): number {
  const n = Number.parseFloat(amount);
  return Number.isNaN(n) ? 0 : n;
}

type LotPriceDisplaySource = Pick<
  Lot,
  | "status"
  | "winnerId"
  | "currentPrice"
  | "auctionType"
  | "buyNowPrice"
  | "startingPrice"
  | "marketingDetails"
> & {
  hasWinner?: boolean;
};

function lotWasSold(lot: LotPriceDisplaySource): boolean {
  return lot.winnerId != null || lot.hasWinner === true;
}

function money(amount: string, lot: LotPriceDisplaySource): string {
  return formatMoney(amount, resolveLotCurrency(lot));
}

/** Human-readable price label + formatted value for marketing cards,
 * derived from lot status, auction type, and price fields (no separate estimate range on Lot).
 */
export function lotPriceDisplay(lot: LotPriceDisplaySource): LotPriceDisplay {
  if (lot.status === "cancelled") {
    return { label: "Withdrawn", value: "—" };
  }

  if (lot.status === "ended") {
    if (lotWasSold(lot)) {
      return { label: "Sold for", value: money(lot.currentPrice, lot) };
    }
    return { label: "Unsold", value: "—" };
  }

  if (lot.auctionType === "buy_it_now" && lot.buyNowPrice) {
    return { label: "Buy now", value: money(lot.buyNowPrice, lot) };
  }

  if (lot.auctionType === "dutch" && lot.status === "active") {
    return { label: "Current price", value: money(lot.currentPrice, lot) };
  }

  if (lot.auctionType === "english" || lot.auctionType === "sealed") {
    const start = toNum(lot.startingPrice);
    const current = toNum(lot.currentPrice);
    if (lot.status === "active" && current > start) {
      return { label: "Current bid", value: money(lot.currentPrice, lot) };
    }
    return { label: "Starting bid", value: money(lot.startingPrice, lot) };
  }

  return { label: "Starting bid", value: money(lot.startingPrice, lot) };
}
