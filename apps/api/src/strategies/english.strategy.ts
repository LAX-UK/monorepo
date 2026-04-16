import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategy } from "../services/interfaces/auction-strategy.js";

function minIncrement(auction: Auction): number {
  const n = Number.parseFloat(auction.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

export class EnglishAuctionStrategy implements IAuctionStrategy {
  validateBid(auction: Auction, bid: NewBid): Result<void, BidError> {
    const current = Number(auction.currentPrice);
    const inc = minIncrement(auction);
    if (bid.amount + 1e-9 < current + inc) {
      return err(new BidError(`Bid must be at least ${(current + inc).toFixed(2)}`));
    }
    if (bid.bidderId === auction.sellerId) {
      return err(new BidError("Seller cannot bid on own auction"));
    }
    return ok(undefined);
  }

  getNextPrice(auction: Auction, currentBidAmount: number): number {
    return Math.max(Number(auction.currentPrice), currentBidAmount);
  }

  shouldExtendTime(auction: Auction, _bid: NewBid): boolean {
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
