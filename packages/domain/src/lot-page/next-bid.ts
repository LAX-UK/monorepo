import type { LotAuctionType } from "@auction/types";
import { addMoneyStrings, numberToMoneyString } from "../money-compare.js";

/** How many valid amounts a maximum-bid select offers. */
export const VALID_BID_AMOUNT_COUNT = 20;

export type NextBidLot = {
  auctionType: LotAuctionType;
  /** Current price; for a sealed lot the starting price (the real figure is never shown). */
  currentPrice: string;
  startingPrice: string;
  minBidIncrement: string;
};

/** The lot's own increment; a missing or zero increment falls back to one penny, as bidding does. */
export function lotIncrement(lot: Pick<NextBidLot, "minBidIncrement">): string {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? numberToMoneyString(n) : "0.01";
}

/**
 * The lowest amount the server accepts next, by the same rule bidding enforces:
 * - English and buy-it-now lots: the current price plus the increment;
 * - sealed lots: the starting price;
 * - Dutch lots: the current price, which the bidder accepts as it stands.
 */
export function nextBidAmount(lot: NextBidLot): string {
  switch (lot.auctionType) {
    case "dutch":
      return numberToMoneyString(Number.parseFloat(lot.currentPrice));
    case "sealed":
      return numberToMoneyString(Number.parseFloat(lot.startingPrice));
    default:
      return addMoneyStrings(lot.currentPrice, lotIncrement(lot));
  }
}

/**
 * The next valid amounts, lowest first: the next bid and then one increment at a time. A Dutch
 * lot has one valid amount; a sealed lot has the same ladder from its starting price.
 */
export function validBidAmounts(lot: NextBidLot, count = VALID_BID_AMOUNT_COUNT): string[] {
  const first = nextBidAmount(lot);
  if (lot.auctionType === "dutch") return [first];
  const step = lotIncrement(lot);
  const amounts: string[] = [];
  let amount = first;
  for (let i = 0; i < Math.max(1, count); i++) {
    amounts.push(amount);
    amount = addMoneyStrings(amount, step);
  }
  return amounts;
}
