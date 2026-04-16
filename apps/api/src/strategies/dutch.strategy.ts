import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategy } from "../services/interfaces/auction-strategy.js";

/** First acceptance at current dutch price wins — modeled as bid amount === currentPrice. */
export class DutchAuctionStrategy implements IAuctionStrategy {
  validateBid(auction: Auction, bid: NewBid): Result<void, BidError> {
    const price = Number(auction.currentPrice);
    if (bid.amount !== price) {
      return err(new BidError("Bid must match current dutch price to accept"));
    }
    if (bid.bidderId === auction.sellerId) {
      return err(new BidError("Seller cannot bid on own auction"));
    }
    return ok(undefined);
  }

  getNextPrice(auction: Auction, _currentBidAmount: number): number {
    return Number(auction.currentPrice);
  }

  shouldExtendTime(): boolean {
    return false;
  }

  determineWinner(_auction: Auction, bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    const sorted = [...bids].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sorted[0] ?? null;
  }
}
