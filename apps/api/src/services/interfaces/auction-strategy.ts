import type { Bid, Lot, NewBid } from "@auction/types";
import type { Result } from "neverthrow";
import type { BidError } from "../../lib/errors.js";

export interface ILotStrategy {
  validateBid(lot: Lot, bid: NewBid): Result<void, BidError>;
  getNextPrice(lot: Lot, currentBidAmount: number): number;
  determineWinner(lot: Lot, bids: Bid[]): Bid | null;
  shouldExtendTime(lot: Lot, bid: NewBid): boolean;
}

export interface ILotStrategyFactory {
  create(type: Lot["auctionType"]): ILotStrategy;
}
