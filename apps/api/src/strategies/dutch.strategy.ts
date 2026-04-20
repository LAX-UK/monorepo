import type { Bid, Lot, NewBid } from "@auction/types";
import { moneyEq } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { ILotStrategy } from "../services/interfaces/auction-strategy.js";

/** First acceptance at current dutch price wins — modeled as bid amount === currentPrice. */
export class DutchAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid): Result<void, BidError> {
    if (!moneyEq(bid.amount.toFixed(2), lot.currentPrice)) {
      return err(new BidError("Bid must match current dutch price to accept"));
    }
    if (bid.bidderId === lot.sellerId) {
      return err(new BidError("Seller cannot bid on own lot"));
    }
    return ok(undefined);
  }

  getNextPrice(lot: Lot, _currentBidAmount: number): number {
    return Number(lot.currentPrice);
  }

  shouldExtendTime(): boolean {
    return false;
  }

  determineWinner(_lot: Lot, bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    const sorted = [...bids].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sorted[0] ?? null;
  }
}
