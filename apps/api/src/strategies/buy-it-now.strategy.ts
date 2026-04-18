import type { Bid, Lot, NewBid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { ILotStrategy } from "../services/interfaces/auction-strategy.js";

function minIncrement(lot: Lot): number {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

export class BuyItNowAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid): Result<void, BidError> {
    if (bid.bidderId === lot.sellerId) {
      return err(new BidError("Seller cannot bid on own lot"));
    }
    const current = Number(lot.currentPrice);
    const buyNow = lot.buyNowPrice ? Number(lot.buyNowPrice) : null;
    if (buyNow !== null && bid.amount >= buyNow) {
      return ok(undefined);
    }
    const inc = minIncrement(lot);
    if (bid.amount + 1e-9 < current + inc) {
      return err(new BidError(`Bid must be at least ${(current + inc).toFixed(2)}`));
    }
    return ok(undefined);
  }

  getNextPrice(lot: Lot, currentBidAmount: number): number {
    const buyNow = lot.buyNowPrice ? Number(lot.buyNowPrice) : null;
    if (buyNow !== null && currentBidAmount >= buyNow) {
      return buyNow;
    }
    return Math.max(Number(lot.currentPrice), currentBidAmount);
  }

  shouldExtendTime(lot: Lot, bid: NewBid): boolean {
    const buyNow = lot.buyNowPrice ? Number(lot.buyNowPrice) : null;
    if (buyNow !== null && bid.amount >= buyNow) return false;
    const msRemaining = lot.endTime.getTime() - Date.now();
    return msRemaining > 0 && msRemaining < 2 * 60 * 1000;
  }

  determineWinner(_lot: Lot, bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    const sorted = [...bids].sort((a, b) => {
      const d = Number(b.amount) - Number(a.amount);
      if (d !== 0) return d;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    return sorted[0] ?? null;
  }
}
