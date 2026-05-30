import type { Bid, Lot, NewBid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { BidPolicyConfig } from "../services/bid/bid-policy.js";
import type { ILotStrategy } from "../services/interfaces/auction-strategy.js";

export class SealedBidAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid): Result<void, BidError> {
    if (lot.status !== "active") {
      return err(new BidError("Sealed bids are only accepted while lot is active"));
    }
    if (
      bid.buyerLegalEntityId && lot.sellerLegalEntityId
        ? bid.buyerLegalEntityId === lot.sellerLegalEntityId
        : bid.bidderId === lot.sellerId
    ) {
      return err(new BidError("Seller cannot bid on own lot"));
    }
    const min = Number(lot.startingPrice);
    if (bid.amount < min) {
      return err(new BidError("Bid must be at least starting price"));
    }
    return ok(undefined);
  }

  getNextPrice(lot: Lot, currentBidAmount: number): number {
    return Math.max(Number(lot.currentPrice), currentBidAmount);
  }

  shouldExtendTime(_lot: Lot, _bid: NewBid, _policy: BidPolicyConfig): boolean {
    return false;
  }

  validateSelfServiceAllowed(lot: Lot, englishOnlyAuctions: boolean): Result<void, BidError> {
    if (englishOnlyAuctions && lot.auctionType !== "english" && lot.auctionType !== "buy_it_now") {
      return err(
        new BidError(
          "Self-service bidding is only available for English and buy-now lots while English-only mode is enabled.",
          400,
          "english_only_catalogue",
        ),
      );
    }
    return ok(undefined);
  }

  determineWinner(_lot: Lot, bids: Bid[]): Bid | null {
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
