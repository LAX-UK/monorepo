import type { Bid, Lot, NewBid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { ILotStrategy } from "../services/interfaces/auction-strategy.js";
import { determineHighestBid } from "./highest-bid-winner.js";

function minIncrement(lot: Lot): number {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

export class EnglishAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid): Result<void, BidError> {
    const current = Number(lot.currentPrice);
    const inc = minIncrement(lot);
    if (bid.amount + 1e-9 < current + inc) {
      return err(new BidError(`Bid must be at least ${(current + inc).toFixed(2)}`));
    }
    if (bid.bidderId === lot.sellerId) {
      return err(new BidError("Seller cannot bid on own lot"));
    }
    return ok(undefined);
  }

  getNextPrice(lot: Lot, currentBidAmount: number): number {
    return Math.max(Number(lot.currentPrice), currentBidAmount);
  }

  shouldExtendTime(lot: Lot, _bid: NewBid): boolean {
    const msRemaining = lot.endTime.getTime() - Date.now();
    return msRemaining > 0 && msRemaining < 2 * 60 * 1000;
  }

  determineWinner(_lot: Lot, bids: Bid[]): Bid | null {
    return determineHighestBid(bids);
  }
}
