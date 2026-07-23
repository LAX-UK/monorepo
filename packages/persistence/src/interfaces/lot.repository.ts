import type { CreateLotInput, Lot, LotStatus } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import type { ArchiveEndedAggregateFilter, ListLotsFilter } from "./filters.js";

export type SaleCatalogLotsSort = "lot" | "priceAsc" | "priceDesc" | "endingAsc";

export type ListCatalogLotsBySalePageInput = {
  saleId: string;
  lotStatuses?: LotStatus[] | undefined;
  requirePublicSale?: boolean | undefined;
  sort: SaleCatalogLotsSort;
  limit: number;
  offset: number;
};

export interface ILotReadRepository {
  findById(id: string): Promise<Lot | null>;
  /** Batch load lots by id (avoids N+1). */
  findByIds(ids: string[]): Promise<Lot[]>;
  /** Lock the lot row for the duration of the current transaction (SELECT FOR UPDATE). */
  findByIdForUpdate(id: string): Promise<Lot | null>;
  list(filter: ListLotsFilter): Promise<Lot[]>;
  /** Count rows matching the same predicates as list (ignores limit/offset/sort). */
  countMatching(filter: Omit<ListLotsFilter, "limit" | "offset" | "sort">): Promise<number>;
  /** List lots belonging to a sale (any status). */
  findBySaleId(saleId: string): Promise<Lot[]>;
  /** Minimal lot fields for saleroom run-order / next-lot resolution. */
  findRunOrderRefsBySaleId(
    saleId: string,
  ): Promise<Array<Pick<Lot, "id" | "lotNumber" | "title" | "status">>>;
  /** Batch lots for many sales (avoids N+1). */
  findBySaleIds(saleIds: string[]): Promise<Lot[]>;
  /** Up to `limitPerSale` preview lots per sale (saleroom cards). */
  findPreviewLotsBySaleIds(
    saleIds: string[],
    limitPerSale: number,
    options?: { publicOnly?: boolean | undefined },
  ): Promise<Lot[]>;
  /** Paginated lots for a sale catalog (saleroom); filter + sort + count in SQL. */
  listCatalogLotsBySalePage(input: ListCatalogLotsBySalePageInput): Promise<{
    items: Lot[];
    total: number;
  }>;
}

export interface ILotWriteRepository {
  create(input: CreateLotInput): Promise<Lot>;
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
}

export interface ILotLifecycleRepository {
  /** Lifecycle: scheduled lots whose start time has passed. */
  findScheduledToActivate(asOf: Date): Promise<Lot[]>;
  /** Lifecycle: active lots whose end time has passed. */
  findActivePastEnd(asOf: Date): Promise<Lot[]>;
  /** Active lots whose endTime is in (endAfter, endBeforeInclusive]. */
  findActiveByEndTimeBetween(endAfter: Date, endBeforeInclusive: Date): Promise<Lot[]>;
  /** Active Dutch lots (for timed price decrements). */
  findActiveDutchLots(): Promise<Lot[]>;
  /** Ended sold lots with a winner but no payment row (reconciliation sweep). */
  listSoldLotsMissingPayment(limit: number): Promise<string[]>;
}

export interface ILotAnalyticsRepository {
  /** Sum of current_price for ended lots (hammer totals), optional calendar year on endTime. */
  sumEndedHammer(filter: ArchiveEndedAggregateFilter): Promise<{ total: string; count: number }>;
  /** UTC day counts for admin KPI trends (created_at >= rangeStart, non-deleted lots). */
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
  countEndedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
  /** Sum hammer (current price) for ended lots per UTC day (by endTime). */
  sumEndedHammerByDay(rangeStart: Date): Promise<Map<string, number>>;
  /** Lot counts per sale id for list endpoints. */
  countLotsBySaleIds(
    saleIds: string[],
    options?: { publicOnly?: boolean | undefined },
  ): Promise<Map<string, number>>;
  /** Aggregate estimate proxy for a sale's lots. */
  sumSaleLotEstimates(saleId: string): Promise<{ total: string; count: number }>;
  /** Bid counts by channel for lots in a sale. */
  countSaleBidActivityByChannel(saleId: string): Promise<{
    online: number;
    room: number;
    phone: number;
  }>;
  /** Distinct bidders on active lots in a sale. */
  countActiveBiddersForSale(saleId: string): Promise<number>;
}

/** Full lot persistence port — composite of segregated read/write/lifecycle/analytics slices (ISP). */
export interface ILotRepository
  extends ILotReadRepository,
    ILotWriteRepository,
    ILotLifecycleRepository,
    ILotAnalyticsRepository {}
