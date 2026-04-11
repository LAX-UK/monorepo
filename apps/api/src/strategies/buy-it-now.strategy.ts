import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { IAuctionStrategy } from "../services/interfaces/auction-strategy.js";

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
    if (bid.amount <= current) {
      return err(new BidError("Bid must exceed current price"));
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
    return bids[0] ?? null;
  }
}
