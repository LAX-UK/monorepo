import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategy } from "../services/interfaces/auction-strategy.js";

export class EnglishAuctionStrategy implements IAuctionStrategy {
  validateBid(auction: Auction, bid: NewBid): Result<void, BidError> {
    const current = Number(auction.currentPrice);
    if (bid.amount <= current) {
      return err(new BidError("Bid must exceed current price"));
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
    return bids[0] ?? null;
  }
}
