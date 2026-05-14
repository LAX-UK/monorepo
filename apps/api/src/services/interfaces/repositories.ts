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
  categoryIds?: string[] | undefined;
  sellerLegalEntityId?: string | undefined;
  winnerId?: string | undefined;
  saleId?: string | undefined;
  /** Filter to lots whose `artist_id` FK matches. Used by the admin artist
   * edit page ("Lots by this artist" panel) and the public artist detail rail. */
  artistId?: string | undefined;
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
  categoryIds?: string[] | undefined;
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
  create(input: CreateLotInput): Promise<Lot>;
  list(filter: ListLotsFilter): Promise<Lot[]>;
  /** Count rows matching the same predicates as list (ignores limit/offset/sort). */
  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number>;
  /** Sum of current_price for ended lots (hammer totals), optional calendar year on endTime. */
  sumEndedHammer(filter: ArchiveEndedAggregateFilter): Promise<{ total: string; count: number }>;
  updateCurrentPrice(id: string, price: string): Promise<void>;
  updateEndTime(id: string, endTime: Date): Promise<void>;
  updateStatus(id: string, status: Lot["status"]): Promise<void>;
  /** void lot after anti-shilling eliminated all reserve-eligible winners at close. */
  voidLotAntiShillingClose(id: string): Promise<void>;
  /** flag draft/scheduled lots whose seller entity was archived. */
  markArchivedSellerOnDraftScheduledLots(sellerLegalEntityId: string): Promise<number>;
  /** Partial update for editable fields (e.g. draft lots). */
  update(id: string, input: Partial<CreateLotInput>): Promise<Lot>;
  /** Merge marketing JSONB for the four managed keys; preserves other marketing keys. */
  updateMarketingDetails(id: string, patch: UpdateLotMarketingDetailsInput): Promise<Lot>;
  setWinner(id: string, winnerId: string, buyerLegalEntityId: string): Promise<void>;
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
  /** Batch fetch by ids — returns only the rows that exist (order not guaranteed). */
  findByIds(ids: string[]): Promise<Sale[]>;
  create(input: CreateSaleInput): Promise<Sale>;
  list(filter: ListSalesFilter): Promise<Sale[]>;
  /** Sales that may need status sync after lot transitions. */
  findWithStatuses(statuses: SaleStatus[]): Promise<Sale[]>;
  update(id: string, patch: Partial<CreateSaleInput>): Promise<Sale>;
  updateStatus(id: string, status: SaleStatus): Promise<void>;
}

export type CreateBidRow = {
  lotId: string;
  placedByUserId: string;
  buyerLegalEntityId: string;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
  placedVia?: string | null;
  telephoneBookingId?: string | null;
};

export interface IBidRepository {
  create(row: CreateBidRow): Promise<Bid>;
  findHighestForLot(lotId: string): Promise<Bid | null>;
  /** Highest amount first; earliest bid wins ties (settlement). */
  listForLotSettlement(lotId: string, limit: number): Promise<Bid[]>;
  /** Bids for lot close that meet reserve and pass anti-shilling in one query
   * (NOT EXISTS shared-member pattern). `sort: "english"` → amount DESC, created_at ASC;
   * `sort: "dutch"` → created_at ASC only. */
  findEligibleBidsForLotClose(
    lotId: string,
    params: {
      sellerLegalEntityId: string | null;
      reservePrice: string | null;
      sort: "english" | "dutch";
    },
  ): Promise<Bid[]>;
  listForLot(lotId: string, limit: number): Promise<Bid[]>;
  findWinningBid(lotId: string): Promise<Bid | null>;
  listDistinctBidderIds(lotId: string): Promise<string[]>;
  /** Latest bids placed by a bidder (for dashboard). */
  listForBidder(bidderId: string, limit: number): Promise<Bid[]>;
  markWinningBid(lotId: string, bidId: string): Promise<void>;
  /** Max effective ceiling per bidder for proxy resolution (English / buy-it-now). */
  aggregateBidderCeilings(lotId: string): Promise<Map<string, number>>;
  /** One row per bidder on the lot: ceiling (max of amount vs max auto) and the
   * buyer legal entity from the bid row that defines that ceiling (for anti-shilling).
   */
  listBidderCeilingStates(
    lotId: string,
  ): Promise<Array<{ bidderId: string; buyerLegalEntityId: string; ceiling: number }>>;
  /** True when the bidder has at least one bid on the lot with a proxy ceiling set. */
  bidderHasProxyMaxOnLot(lotId: string, bidderId: string): Promise<boolean>;
  /** Clears proxy auto-bid fields for all bids by this bidder on the lot. */
  clearProxyAutoBidForBidderOnLot(lotId: string, bidderId: string): Promise<number>;
  /** distinct (lotId, bidderId) with active proxy ceiling for buyer entity on active lots. */
  listActiveProxyBidPairsForBuyerEntity(
    buyerLegalEntityId: string,
  ): Promise<{ lotId: string; bidderId: string }[]>;
  /** proxy rows for removed member on entity's active lots. */
  listActiveProxyBidPairsForMemberOnEntity(
    placedByUserId: string,
    buyerLegalEntityId: string,
  ): Promise<{ lotId: string; bidderId: string }[]>;
}

export type UserProfileRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  staffRole: string | null;
  /** Public avatar URL (OAuth / profile); safe to expose on public user endpoints */
  image: string | null;
  hasSeenActingContextTooltip: boolean;
};

export interface IUserRepository {
  findById(id: string): Promise<UserProfileRow | null>;
  listIdsByRole(role: string): Promise<string[]>;
  /** Staff user ids that should receive new-item-submission notifications (appraisal / catalogue / auction). */
  listStaffIdsForSubmissionNotifications(): Promise<string[]>;
  /** Public directory rows (no email) for marketing / mega-menu. */
  listPublicProfiles(params: {
    limit: number;
    offset: number;
  }): Promise<{ id: string; name: string; image: string | null }[]>;
  /** Mark the acting context tooltip as seen for the user. */
  updateActingContextTooltipSeen(userId: string, seen: boolean): Promise<void>;
}

export type ListSubmissionsFilter = {
  status?: ItemSubmissionStatus | undefined;
  legalEntityId?: string | undefined;
  q?: string | undefined;
  limit: number;
  offset: number;
};

export type ItemSubmissionUpdatePatch = {
  title?: string;
  description?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  images?: string[];
  yearOfWork?: string | null;
  isSigned?: boolean;
  signatureNote?: string | null;
  edition?: string | null;
  conditionSelfReport?: string | null;
  provenance?: { period?: string | undefined; note: string }[];
  exhibitions?: { year?: string | undefined; venue: string; note?: string | undefined }[];
  askingPrice?: string | null;
  reservePrice?: string | null;
  categoryId?: string;
  categoryIds?: string[];
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
  create(input: CreateItemSubmissionInput): Promise<ItemSubmission>;
  update(id: string, patch: ItemSubmissionUpdatePatch): Promise<ItemSubmission>;
  listForLegalEntity(legalEntityId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
}
