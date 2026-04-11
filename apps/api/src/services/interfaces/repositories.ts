import type { Auction, AuctionStatus, CreateAuctionInput } from "@auction/types";
import type { Bid } from "@auction/types";

export type ListAuctionsFilter = {
  status?: AuctionStatus | undefined;
  categoryId?: string | undefined;
  sellerId?: string | undefined;
  winnerId?: string | undefined;
  limit: number;
  offset: number;
};

export interface IAuctionRepository {
  findById(id: string): Promise<Auction | null>;
  /** Lock the auction row for the duration of the current transaction (SELECT FOR UPDATE). */
  findByIdForUpdate(id: string): Promise<Auction | null>;
  create(sellerId: string, input: CreateAuctionInput): Promise<Auction>;
  list(filter: ListAuctionsFilter): Promise<Auction[]>;
  updateCurrentPrice(id: string, price: string): Promise<void>;
  updateEndTime(id: string, endTime: Date): Promise<void>;
  updateStatus(id: string, status: Auction["status"]): Promise<void>;
  setWinner(id: string, winnerId: string): Promise<void>;
}

export type CreateBidRow = {
  auctionId: string;
  bidderId: string;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
};

export interface IBidRepository {
  create(row: CreateBidRow): Promise<Bid>;
  findHighestForAuction(auctionId: string): Promise<Bid | null>;
  listForAuction(auctionId: string, limit: number): Promise<Bid[]>;
  /** Latest bids placed by a bidder (for dashboard). */
  listForBidder(bidderId: string, limit: number): Promise<Bid[]>;
  markWinningBid(auctionId: string, bidId: string): Promise<void>;
}

export type UserProfileRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export interface IUserRepository {
  findById(id: string): Promise<UserProfileRow | null>;
}
