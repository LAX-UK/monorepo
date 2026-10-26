import type {
  AdminPaymentTableRowDto,
  AdminPaymentsSummaryStats,
  IPaymentWriteRepository,
  ListPaymentsAdminTableFilter,
} from "@auction/persistence/interfaces";
import { buildTrendWindows } from "./admin-kpi-trend.helpers.js";

/** Days in the summary's volume trend, and in the window it is compared against. */
export const PAYMENTS_VOLUME_TREND_DAYS = 30;

/** Volume of the matching payments created each day, oldest first, with the two window totals. */
export type AdminPaymentsVolumeTrend = {
  periodDays: number;
  /** One value per UTC day, in pence. */
  dailyPence: number[];
  currentPence: number;
  /** The same number of days immediately before. */
  priorPence: number;
};

export type AdminPaymentListPage = {
  rows: AdminPaymentTableRowDto[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPaymentsSummaryStats & { volumeTrend: AdminPaymentsVolumeTrend };
};

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
    const { currentKeys, priorKeys, rangeStart } = buildTrendWindows(PAYMENTS_VOLUME_TREND_DAYS);
    const [rows, total, summary, volumeByDay] = await Promise.all([
      this.payments.listForAdminTable(filter),
      this.payments.countForAdminTable(tableFilter),
      this.payments.summarizeForAdminTable(tableFilter),
      this.payments.sumAdminTableVolumeByDay(tableFilter, rangeStart),
    ]);
    const dailyPence = currentKeys.map((key) => volumeByDay.get(key) ?? 0);
    const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
    return {
      rows,
      total,
      offset: filter.offset,
      limit: filter.limit,
      summary: {
        ...summary,
        volumeTrend: {
          periodDays: PAYMENTS_VOLUME_TREND_DAYS,
          dailyPence,
          currentPence: sum(dailyPence),
          priorPence: sum(priorKeys.map((key) => volumeByDay.get(key) ?? 0)),
        },
      },
    };
  }
}
