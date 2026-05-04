import type {
  Bid,
  CreateItemSubmissionInput,
  CreateLotInput,
  CreateSaleInput,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  LotStatus,
  Sale,
  SaleStatus,
} from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";

export type ListLotsSort =
  | "createdDesc"
  | "endingAsc"
  | "hammerDesc"
  | "endedDesc"
  /** Seller display name A–Z (joins user; stable tie-break on endTime desc). */
  | "sellerAsc";

export type ListLotsFilter = {
  status?: LotStatus | undefined;
  categoryId?: string | undefined;
  sellerId?: string | undefined;
  winnerId?: string | undefined;
  saleId?: string | undefined;
  /** Restrict lots whose endTime falls in this calendar year (UTC). */
  endYear?: number | undefined;
  /** Case-insensitive substring match on title (public catalogue search). */
  search?: string | undefined;
  limit: number;
  offset: number;
  sort?: ListLotsSort | undefined;
};

export type ListSalesSort = "createdDesc" | "startAsc";

export type ListSalesFilter = {
  status?: SaleStatus | undefined;
  statuses?: SaleStatus[] | undefined;
  categoryId?: string | undefined;
  limit: number;
  offset: number;
  sort?: ListSalesSort | undefined;
};

/** Aggregate for archive / past-auctions views (ended lots). */
export type ArchiveEndedAggregateFilter = {
  endYear?: number | undefined;
};

export interface ILotRepository {
  findById(id: string): Promise<Lot | null>;
  /** Lock the lot row for the duration of the current transaction (SELECT FOR UPDATE). */
  findByIdForUpdate(id: string): Promise<Lot | null>;
  create(sellerId: string, input: CreateLotInput): Promise<Lot>;
  list(filter: ListLotsFilter): Promise<Lot[]>;
  /** Count rows matching the same predicates as list (ignores limit/offset/sort). */
  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number>;
  /** Sum of current_price for ended lots (hammer totals), optional calendar year on endTime. */
  sumEndedHammer(filter: ArchiveEndedAggregateFilter): Promise<{ total: string; count: number }>;
  updateCurrentPrice(id: string, price: string): Promise<void>;
  updateEndTime(id: string, endTime: Date): Promise<void>;
  updateStatus(id: string, status: Lot["status"]): Promise<void>;
  /** Partial update for editable fields (e.g. draft lots). */
  update(id: string, input: Partial<CreateLotInput>): Promise<Lot>;
  /** Merge marketing JSONB for the four managed keys; preserves other marketing keys. */
  updateMarketingDetails(id: string, patch: UpdateLotMarketingDetailsInput): Promise<Lot>;
  setWinner(id: string, winnerId: string): Promise<void>;
  /** Lifecycle: scheduled lots whose start time has passed. */
  findScheduledToActivate(asOf: Date): Promise<Lot[]>;
  /** Lifecycle: active lots whose end time has passed. */
  findActivePastEnd(asOf: Date): Promise<Lot[]>;
  /** Active lots whose endTime is in (endAfter, endBeforeInclusive]. */
  findActiveByEndTimeBetween(endAfter: Date, endBeforeInclusive: Date): Promise<Lot[]>;
  /** Active Dutch lots (for timed price decrements). */
  findActiveDutchLots(): Promise<Lot[]>;
  setDutchLastDecrementAt(id: string, at: Date | null): Promise<void>;
  updateDutchCurrentPrice(id: string, price: string, lastDecrementAt: Date): Promise<void>;
  updateDutchCurrentPriceIfMatch(
    id: string,
    expectedPrice: string,
    nextPrice: string,
    lastDecrementAt: Date,
  ): Promise<boolean>;
  /** Clear sale association (admin detach; draft sale only at service layer). */
  clearSaleId(id: string): Promise<void>;
  /** List lots belonging to a sale (any status). */
  findBySaleId(saleId: string): Promise<Lot[]>;
  /** Batch lots for many sales (avoids N+1). */
  findBySaleIds(saleIds: string[]): Promise<Lot[]>;
}

export interface ISaleRepository {
  findById(id: string): Promise<Sale | null>;
  create(input: CreateSaleInput): Promise<Sale>;
  list(filter: ListSalesFilter): Promise<Sale[]>;
  /** Sales that may need status sync after lot transitions. */
  findWithStatuses(statuses: SaleStatus[]): Promise<Sale[]>;
  update(id: string, patch: Partial<CreateSaleInput>): Promise<Sale>;
  updateStatus(id: string, status: SaleStatus): Promise<void>;
}

export type CreateBidRow = {
  lotId: string;
  bidderId: string;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
};

export interface IBidRepository {
  create(row: CreateBidRow): Promise<Bid>;
  findHighestForLot(lotId: string): Promise<Bid | null>;
  /** Highest amount first; earliest bid wins ties (settlement). */
  listForLotSettlement(lotId: string, limit: number): Promise<Bid[]>;
  listForLot(lotId: string, limit: number): Promise<Bid[]>;
  findWinningBid(lotId: string): Promise<Bid | null>;
  listDistinctBidderIds(lotId: string): Promise<string[]>;
  /** Latest bids placed by a bidder (for dashboard). */
  listForBidder(bidderId: string, limit: number): Promise<Bid[]>;
  markWinningBid(lotId: string, bidId: string): Promise<void>;
  /** Max effective ceiling per bidder for proxy resolution (English / buy-it-now). */
  aggregateBidderCeilings(lotId: string): Promise<Map<string, number>>;
}

export type UserProfileRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  /** Public avatar URL (OAuth / profile); safe to expose on public user endpoints */
  image: string | null;
};

export interface IUserRepository {
  findById(id: string): Promise<UserProfileRow | null>;
  listIdsByRole(role: string): Promise<string[]>;
  /** Public directory rows (no email) for marketing / mega-menu. */
  listPublicProfiles(params: {
    limit: number;
    offset: number;
  }): Promise<{ id: string; name: string; image: string | null }[]>;
}

export type ListSubmissionsFilter = {
  status?: ItemSubmissionStatus | undefined;
  sellerId?: string | undefined;
  limit: number;
  offset: number;
};

export type ItemSubmissionUpdatePatch = {
  title?: string;
  description?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  images?: string[];
  askingPrice?: string | null;
  reservePrice?: string | null;
  categoryId?: string;
  submitterNotes?: string | null;
  status?: ItemSubmissionStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  convertedLotId?: string | null;
};

export interface IItemSubmissionRepository {
  findById(id: string): Promise<ItemSubmission | null>;
  create(sellerId: string, input: CreateItemSubmissionInput): Promise<ItemSubmission>;
  update(id: string, patch: ItemSubmissionUpdatePatch): Promise<ItemSubmission>;
  listForSeller(sellerId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
}
