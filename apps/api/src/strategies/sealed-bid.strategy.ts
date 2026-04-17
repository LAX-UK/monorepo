import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategy } from "../services/interfaces/auction-strategy.js";

export class SealedBidAuctionStrategy implements IAuctionStrategy {
  validateBid(auction: Auction, bid: NewBid): Result<void, BidError> {
    if (auction.status !== "active") {
      return err(new BidError("Sealed bids are only accepted while auction is active"));
    }
    if (bid.bidderId === auction.sellerId) {
      return err(new BidError("Seller cannot bid on own auction"));
    }
    const min = Number(auction.startingPrice);
    if (bid.amount < min) {
      return err(new BidError("Bid must be at least starting price"));
    }
    return ok(undefined);
  }

  getNextPrice(auction: Auction, currentBidAmount: number): number {
    return Math.max(Number(auction.currentPrice), currentBidAmount);
  }

  shouldExtendTime(): boolean {
    return false;
  }

  determineWinner(_auction: Auction, bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    let best = bids[0];
    if (!best) return null;
    for (const b of bids.slice(1)) {
      const amt = Number(b.amount);
      const bestAmt = Number(best.amount);
      if (amt > bestAmt || (amt === bestAmt && b.createdAt.getTime() < best.createdAt.getTime())) {
        best = b;
      }
    }
    return best;
  }
}
