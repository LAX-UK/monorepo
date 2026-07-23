import type { Bid, Lot, NewBid } from "@auction/types";
import { moneyEq } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { BidPolicyConfig } from "../bid-policy.js";
import type { EarlyCloseResolution, ILotStrategy } from "../ports.js";

/** First acceptance at current dutch price wins — modeled as bid amount === currentPrice. */
export class DutchAuctionStrategy implements ILotStrategy {
  validateBid(lot: Lot, bid: NewBid): Result<void, BidError> {
    if (!moneyEq(String(bid.amount), lot.currentPrice)) {
      return err(new BidError("Bid must match current dutch price to accept"));
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

  getNextPrice(lot: Lot, _currentBidAmount: number): number {
    return Number(lot.currentPrice);
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

  resolveEarlyClose(
    _lot: Lot,
    lastBid: Bid,
    ctx: { buyerLegalEntityId: string },
  ): EarlyCloseResolution | null {
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
    if (bids.length === 0) return null;
    const sorted = [...bids].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sorted[0] ?? null;
  }
}
