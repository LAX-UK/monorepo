import type { Bid, Lot, NewBid } from "@auction/types";
import type { Result } from "neverthrow";
import type { BidError } from "../../lib/errors.js";
import type { BidPolicyConfig } from "../bid/bid-policy.js";

export type EarlyCloseResolution = {
  endedEarly: true;
  winnerUserId: string;
  winnerLegalEntityId: string;
  hammerPrice: string;
};

export type ValidateBidContext = {
  currentWinnerId?: string | null;
  /** Origin of bid placement; operator paths skip self-service-only guards. */
  placedVia?: string | null;
};

/** Telephone, absentee, and saleroom bids are entered by staff/automation, not self-service. */
export function isOperatorPlacement(placedVia?: string | null): boolean {
  return placedVia === "telephone" || placedVia === "absentee" || placedVia === "saleroom";
}

export interface ILotStrategy {
  validateBid(lot: Lot, bid: NewBid, ctx?: ValidateBidContext): Result<void, BidError>;
  getNextPrice(lot: Lot, currentBidAmount: number): number;
  determineWinner(lot: Lot, bids: Bid[]): Bid | null;
  shouldExtendTime(lot: Lot, bid: NewBid, policy: BidPolicyConfig): boolean;
  /** Gate self-service bids when catalogue policy restricts auction types. */
  validateSelfServiceAllowed?(lot: Lot, englishOnlyAuctions: boolean): Result<void, BidError>;
  /** Returns early-close outcome when a bid ends the lot before scheduled end. */
  resolveEarlyClose?(
    lot: Lot,
    lastBid: Bid,
    ctx: { buyerLegalEntityId: string },
  ): EarlyCloseResolution | null;
}

export interface ILotStrategyFactory {
  create(type: Lot["auctionType"]): ILotStrategy;
}
