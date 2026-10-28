import type { BuyerPremiumTier, ItemSubmissionStatus, LotStatus } from "@auction/types";
import type { SubmissionSenderFilter } from "./item-submission.repository.js";

/**
 * Read models behind an organisation's Home figures, one port per figure group. Each reads one
 * organisation, bounded and indexed; what a figure means (stages, totals, the year) is decided by
 * the domain from these rows.
 */

/** The organisation's consignments, narrowed by who sent them when `visibleTo` is set. */
export type ConsignmentReadScope = {
  legalEntityId: string;
  visibleTo?: SubmissionSenderFilter | undefined;
};

/** Submissions without a lot by status, and the organisation's lots by status and outcome. */
export type ConsignmentStatusCounts = {
  submissions: { status: ItemSubmissionStatus; count: number }[];
  lots: { status: LotStatus; sold: boolean; count: number }[];
};

export interface IConsignmentStatusCountsReader {
  count(scope: ConsignmentReadScope): Promise<ConsignmentStatusCounts>;
}

/** One upcoming sale and currency with the organisation's works in it. */
export type UpcomingSaleWorksRow = {
  saleId: string;
  title: string;
  startsAt: Date;
  currency: string;
  works: number;
  estimatedWorks: number;
  estimateLow: string;
  estimateHigh: string;
};

export interface IUpcomingSaleWorksReader {
  /** Sales that have not ended, soonest first, at most `limit` rows. */
  list(scope: ConsignmentReadScope, now: Date, limit: number): Promise<UpcomingSaleWorksRow[]>;
}

/** A count and a total in one currency. */
export type CurrencyCountRow = { currency: string; count: number; amount: string };

export interface ISoldWorksReader {
  /** Hammer prices of the organisation's works sold with an end time in `[from, to)`. */
  soldBetween(legalEntityId: string, from: Date, to: Date): Promise<CurrencyCountRow[]>;
}

export interface IPayoutsDueReader {
  /** Net totals of payouts scheduled or in transit, with the soonest settlement date. */
  listDue(legalEntityId: string): Promise<(CurrencyCountRow & { nextDate: Date | null })[]>;
}

export interface IOpenBidsReader {
  /**
   * Lots still open where the organisation has bid, with the most it could pay on each
   * (highest bid, auto-bid ceiling or absentee maximum). `bidderUserId` narrows to one member.
   */
  summarise(legalEntityId: string, bidderUserId: string | null): Promise<CurrencyCountRow[]>;
}

/** A won lot not paid yet, with what its total is worked out from. */
export type UnpaidPurchaseRow = {
  lotId: string;
  hammer: string;
  lotPremiumRate: string;
  saleTiers: BuyerPremiumTier[] | null;
  currency: string;
};

export interface IUnpaidPurchasesReader {
  /** The organisation's won lots with no captured or refunded payment, at most `limit`. */
  list(legalEntityId: string, limit: number): Promise<UnpaidPurchaseRow[]>;
}
