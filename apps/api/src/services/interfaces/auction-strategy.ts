import type { Auction } from "@auction/types";
import type { Bid, NewBid } from "@auction/types";
import type { Result } from "neverthrow";
import type { BidError } from "../../lib/errors.js";

export interface IAuctionStrategy {
  validateBid(auction: Auction, bid: NewBid): Result<void, BidError>;
  getNextPrice(auction: Auction, currentBidAmount: number): number;
  determineWinner(auction: Auction, bids: Bid[]): Bid | null;
  shouldExtendTime(auction: Auction, bid: NewBid): boolean;
}

export interface IAuctionStrategyFactory {
  create(type: Auction["auctionType"]): IAuctionStrategy;
}
