import type { Auction, AuctionStatus, CreateAuctionInput } from "@auction/types";
import type { Bid } from "@auction/types";

export type ListAuctionsSort = "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc";

export type ListAuctionsFilter = {
  status?: AuctionStatus | undefined;
  categoryId?: string | undefined;
  sellerId?: string | undefined;
  winnerId?: string | undefined;
  /** Restrict lots whose endTime falls in this calendar year (UTC). */
  endYear?: number | undefined;
  limit: number;
  offset: number;
  sort?: ListAuctionsSort | undefined;
};

/** Aggregate for archive / past-auctions views (ended lots). */
export type ArchiveEndedAggregateFilter = {
  endYear?: number | undefined;
};

export interface IAuctionRepository {
  findById(id: string): Promise<Auction | null>;
  /** Lock the auction row for the duration of the current transaction (SELECT FOR UPDATE). */
  findByIdForUpdate(id: string): Promise<Auction | null>;
  create(sellerId: string, input: CreateAuctionInput): Promise<Auction>;
  list(filter: ListAuctionsFilter): Promise<Auction[]>;
  /** Count rows matching the same predicates as list (ignores limit/offset/sort). */
  countMatching(filter: Omit<ListAuctionsFilter, "limit" | "offset" | "sort">): Promise<number>;
  /** Sum of current_price for ended auctions (hammer totals), optional calendar year on endTime. */
  sumEndedHammer(filter: ArchiveEndedAggregateFilter): Promise<{ total: string; count: number }>;
  updateCurrentPrice(id: string, price: string): Promise<void>;
  updateEndTime(id: string, endTime: Date): Promise<void>;
  updateStatus(id: string, status: Auction["status"]): Promise<void>;
  setWinner(id: string, winnerId: string): Promise<void>;
  /** Lifecycle: scheduled auctions whose start time has passed. */
  findScheduledToActivate(asOf: Date): Promise<Auction[]>;
  /** Lifecycle: active auctions whose end time has passed. */
  findActivePastEnd(asOf: Date): Promise<Auction[]>;
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
