import type { Bid, Lot, NewBid } from "@auction/types";
import { moneyGte } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import {
  bidAmountBelowMinimum,
  lotMinIncrementMoney,
  minBidAmountMoney,
} from "../services/bid/bid-money.js";
import type { BidPolicyConfig } from "../services/bid/bid-policy.js";
import type {
  EarlyCloseResolution,
  ILotStrategy,
  ValidateBidContext,
} from "../services/interfaces/auction-strategy.js";
import { isOperatorPlacement } from "../services/interfaces/auction-strategy.js";
import { determineHighestBid } from "./highest-bid-winner.js";

export class BuyItNowAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid, ctx?: ValidateBidContext): Result<void, BidError> {
    if (
      bid.buyerLegalEntityId && lot.sellerLegalEntityId
        ? bid.buyerLegalEntityId === lot.sellerLegalEntityId
        : bid.bidderId === lot.sellerId
    ) {
      return err(new BidError("Seller cannot bid on own lot", 400, "seller_cannot_bid"));
    }
    const buyNow = lot.buyNowPrice?.trim();
    if (buyNow && moneyGte(String(bid.amount), buyNow)) {
      return ok(undefined);
    }
    const winnerId = ctx?.currentWinnerId;
    const bidderKey = bid.placedByUserId ?? bid.bidderId;
    if (!isOperatorPlacement(ctx?.placedVia) && winnerId && bidderKey && winnerId === bidderKey) {
      return err(new BidError("You are already the highest bidder", 400, "already_leading"));
    }
    const inc = lotMinIncrementMoney(lot);
    if (bidAmountBelowMinimum(bid.amount, lot.currentPrice, inc)) {
      return err(new BidError(`Bid must be at least ${minBidAmountMoney(lot.currentPrice, inc)}`));
    }
    return ok(undefined);
  }

  getNextPrice(lot: Lot, currentBidAmount: number): number {
    const buyNow = lot.buyNowPrice ? Number(lot.buyNowPrice) : null;
    if (buyNow !== null && currentBidAmount >= buyNow) {
      return buyNow;
    }
    return Math.max(Number(lot.currentPrice), currentBidAmount);
  }

  shouldExtendTime(lot: Lot, bid: NewBid, policy: BidPolicyConfig): boolean {
    const buyNow = lot.buyNowPrice ? Number(lot.buyNowPrice) : null;
    if (buyNow !== null && bid.amount >= buyNow) return false;
    const msRemaining = lot.endTime.getTime() - Date.now();
    return msRemaining > 0 && msRemaining < policy.antiSnipingWindowMs;
  }

  validateSelfServiceAllowed(_lot: Lot, _englishOnlyAuctions: boolean): Result<void, BidError> {
    return ok(undefined);
  }

  resolveEarlyClose(
    lot: Lot,
    lastBid: Bid,
    ctx: { buyerLegalEntityId: string },
  ): EarlyCloseResolution | null {
    const buyNow = lot.buyNowPrice?.trim();
    if (!buyNow || buyNow === "" || !moneyGte(lastBid.amount, buyNow)) {
      return null;
    }
    const winnerUserId = lastBid.placedByUserId ?? lastBid.bidderId;
    const winnerLegalEntityId = lastBid.buyerLegalEntityId ?? ctx.buyerLegalEntityId;
    if (!winnerUserId || !winnerLegalEntityId) return null;
    return {
      endedEarly: true,
      winnerUserId,
      winnerLegalEntityId,
      hammerPrice: lastBid.amount,
    };
  }

  determineWinner(_lot: Lot, bids: Bid[]): Bid | null {
    return determineHighestBid(bids);
  }
}
