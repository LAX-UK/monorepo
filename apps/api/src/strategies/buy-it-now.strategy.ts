import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategy } from "../services/interfaces/auction-strategy.js";

function minIncrement(auction: Auction): number {
  const n = Number.parseFloat(auction.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

export class BuyItNowAuctionStrategy implements IAuctionStrategy {
  validateBid(auction: Auction, bid: NewBid): Result<void, BidError> {
    if (bid.bidderId === auction.sellerId) {
      return err(new BidError("Seller cannot bid on own auction"));
    }
    const current = Number(auction.currentPrice);
    const buyNow = auction.buyNowPrice ? Number(auction.buyNowPrice) : null;
    if (buyNow !== null && bid.amount >= buyNow) {
      return ok(undefined);
    }
    const inc = minIncrement(auction);
    if (bid.amount + 1e-9 < current + inc) {
      return err(new BidError(`Bid must be at least ${(current + inc).toFixed(2)}`));
    }
    return ok(undefined);
  }

  getNextPrice(auction: Auction, currentBidAmount: number): number {
    const buyNow = auction.buyNowPrice ? Number(auction.buyNowPrice) : null;
    if (buyNow !== null && currentBidAmount >= buyNow) {
      return buyNow;
    }
    return Math.max(Number(auction.currentPrice), currentBidAmount);
  }

  shouldExtendTime(auction: Auction, bid: NewBid): boolean {
    const buyNow = auction.buyNowPrice ? Number(auction.buyNowPrice) : null;
    if (buyNow !== null && bid.amount >= buyNow) return false;
    const msRemaining = auction.endTime.getTime() - Date.now();
    return msRemaining > 0 && msRemaining < 2 * 60 * 1000;
  }

  determineWinner(_auction: Auction, bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    const sorted = [...bids].sort((a, b) => {
      const d = Number(b.amount) - Number(a.amount);
      if (d !== 0) return d;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    return sorted[0] ?? null;
  }
}
