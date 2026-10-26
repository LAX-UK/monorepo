import type {
  AdminPaymentTableRowDto,
  AdminPaymentsDailyAmounts,
  AdminPaymentsSummaryStats,
  IPaymentWriteRepository,
  ListPaymentsAdminTableFilter,
} from "@auction/persistence/interfaces";
import { buildTrendWindows } from "./admin-kpi-trend.helpers.js";

/** Days in the summary's trends, and in the window each is compared against. */
export const PAYMENTS_TREND_DAYS = 30;

/** One total's daily series, oldest first, in pence, with the totals of the two windows. */
export type AdminPaymentsTrend = {
  dailyPence: number[];
  currentPence: number;
  /** The same number of days immediately before. */
  priorPence: number;
};

/**
 * The matching payments created each day, by where they are now: the volume, and the captured,
 * refunded and awaiting-capture parts of it.
 */
export type AdminPaymentsTrends = { periodDays: number } & Record<
  keyof AdminPaymentsDailyAmounts,
  AdminPaymentsTrend
>;

export type AdminPaymentListPage = {
  rows: AdminPaymentTableRowDto[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPaymentsSummaryStats & { trends: AdminPaymentsTrends };
};

const BUCKETS = ["volume", "captured", "refunded", "awaiting"] as const;

/** Lays the per-day amounts out over the trend window and the window before it. */
export function buildPaymentsTrends(
  byDay: ReadonlyMap<string, AdminPaymentsDailyAmounts>,
  currentKeys: readonly string[],
  priorKeys: readonly string[],
): AdminPaymentsTrends {
  const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
  const series = (bucket: keyof AdminPaymentsDailyAmounts): AdminPaymentsTrend => {
    const dailyPence = currentKeys.map((key) => byDay.get(key)?.[bucket] ?? 0);
    return {
      dailyPence,
      currentPence: sum(dailyPence),
      priorPence: sum(priorKeys.map((key) => byDay.get(key)?.[bucket] ?? 0)),
    };
  };
  const trends = Object.fromEntries(BUCKETS.map((bucket) => [bucket, series(bucket)])) as Record<
    keyof AdminPaymentsDailyAmounts,
    AdminPaymentsTrend
  >;
  return { periodDays: currentKeys.length, ...trends };
}

/** Paginated admin payments table read model (no KPI or capture logic). */
export class AdminPaymentListQueryService {
  constructor(private readonly payments: IPaymentWriteRepository) {}

  async getPage(filter: ListPaymentsAdminTableFilter): Promise<AdminPaymentListPage> {
    const tableFilter = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { q: filter.q } : {}),
      ...(filter.fulfilmentStatuses?.length
        ? { fulfilmentStatuses: filter.fulfilmentStatuses }
        : {}),
      ...(filter.xeroInvoice ? { xeroInvoice: filter.xeroInvoice } : {}),
    };
    const { currentKeys, priorKeys, rangeStart } = buildTrendWindows(PAYMENTS_TREND_DAYS);
    const [rows, total, summary, amountsByDay] = await Promise.all([
      this.payments.listForAdminTable(filter),
      this.payments.countForAdminTable(tableFilter),
      this.payments.summarizeForAdminTable(tableFilter),
      this.payments.sumAdminTableAmountsByDay(tableFilter, rangeStart),
    ]);
    return {
      rows,
      total,
      offset: filter.offset,
      limit: filter.limit,
      summary: { ...summary, trends: buildPaymentsTrends(amountsByDay, currentKeys, priorKeys) },
    };
  }
}
