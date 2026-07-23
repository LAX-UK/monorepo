import { isOperatorPlacement } from "@auction/domain";
import type { Bid, Lot, NewBid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import { bidAmountBelowMinimum, lotMinIncrementMoney, minBidAmountMoney } from "../bid-money.js";
import type { BidPolicyConfig } from "../bid-policy.js";
import type { ILotStrategy, ValidateBidContext } from "../ports.js";
import { determineHighestBid } from "./highest-bid-winner.js";

export class EnglishAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid, ctx?: ValidateBidContext): Result<void, BidError> {
    const inc = lotMinIncrementMoney(lot);
    if (bidAmountBelowMinimum(bid.amount, lot.currentPrice, inc)) {
      return err(new BidError(`Bid must be at least ${minBidAmountMoney(lot.currentPrice, inc)}`));
    }
    const winnerId = ctx?.currentWinnerId;
    const bidderKey = bid.placedByUserId ?? bid.bidderId;
    if (!isOperatorPlacement(ctx?.placedVia) && winnerId && bidderKey && winnerId === bidderKey) {
      return err(new BidError("You are already the highest bidder", 400, "already_leading"));
    }
    if (
      bid.buyerLegalEntityId && lot.sellerLegalEntityId
        ? bid.buyerLegalEntityId === lot.sellerLegalEntityId
        : bid.bidderId === lot.sellerId
    ) {
      return err(new BidError("Seller cannot bid on own lot", 400, "seller_cannot_bid"));
    }
    return ok(undefined);
  }

  getNextPrice(lot: Lot, currentBidAmount: number): number {
    const currentMinor = Number.parseFloat(lot.currentPrice);
    return Math.max(currentMinor, currentBidAmount);
  }

  shouldExtendTime(lot: Lot, _bid: NewBid, policy: BidPolicyConfig): boolean {
    const msRemaining = lot.endTime.getTime() - Date.now();
    return msRemaining > 0 && msRemaining < policy.antiSnipingWindowMs;
  }

  validateSelfServiceAllowed(_lot: Lot, _englishOnlyAuctions: boolean): Result<void, BidError> {
    return ok(undefined);
  }

  determineWinner(_lot: Lot, bids: Bid[]): Bid | null {
    return determineHighestBid(bids);
  }
}
