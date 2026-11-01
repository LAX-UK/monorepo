import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import type { SubmissionSenderFilter } from "./item-submission.repository.js";

/**
 * Read models behind an organisation's Home figures, one port per figure group. Each reads one
 * organisation, bounded and indexed; what a figure means (stages, totals, the year) is decided by
 * the domain from these rows.
 */

/** The organisation's consignments: submissions narrowed by `visibleTo`, lots by `lotsSentBy`. */
export type ConsignmentReadScope = {
  legalEntityId: string;
  visibleTo?: SubmissionSenderFilter | undefined;
  /** Set when the member sees only the lots made from the submissions they sent. */
  lotsSentBy?: string | undefined;
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

/** Payouts still to arrive in one currency, with their settlement dates either side of now. */
export type PayoutsDueRow = CurrencyCountRow & {
  /** The soonest settlement date still ahead of `now`. */
  nextDate: Date | null;
  /** The earliest settlement date already past `now` (overdue). */
  overdueSince: Date | null;
};

export interface IPayoutsDueReader {
  /**
   * Net totals of payouts scheduled or in transit, with the soonest date ahead and the earliest
   * date already past, so an overdue payout never hides the next one.
   */
  listDue(legalEntityId: string, now: Date): Promise<PayoutsDueRow[]>;
}
