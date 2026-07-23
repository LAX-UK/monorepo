import type {
  ISaleOverviewKpiTrendReader,
  ISaleRepository,
  SaleOverviewKpiDailySignals,
} from "@auction/persistence/interfaces";
import { composeTieredRevenueDailySeries } from "@auction/validators";
import type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "../interfaces/admin-kpi-trend.js";
import type {
  AdminSaleOverviewKpiTrends,
  IAdminSaleOverviewKpiTrendService,
} from "../interfaces/admin-sale-overview-kpi-trend.js";
import { buildTrendWindows, bundleFromDailyCounts } from "./admin-kpi-trend.helpers.js";

function bundleFromMap(
  countsByDay: ReadonlyMap<string, number>,
  currentKeys: readonly string[],
  priorKeys: readonly string[],
): AdminKpiTrendBundle {
  return bundleFromDailyCounts(countsByDay, currentKeys, priorKeys);
}

function mapSignalsToBundles(
  signals: SaleOverviewKpiDailySignals,
  currentKeys: readonly string[],
  priorKeys: readonly string[],
  revenueByDay: Map<string, number>,
): Omit<AdminSaleOverviewKpiTrends, never> {
  return {
    lots: bundleFromMap(signals.lotsAddedByDay, currentKeys, priorKeys),
    estimate: bundleFromMap(signals.estimateAddedByDayPence, currentKeys, priorKeys),
    hammer: bundleFromMap(signals.bidAmountByDayPence, currentKeys, priorKeys),
    revenue: bundleFromMap(revenueByDay, currentKeys, priorKeys),
    registrations: bundleFromMap(signals.registrationsByDay, currentKeys, priorKeys),
    bidders: bundleFromMap(signals.distinctBiddersByDay, currentKeys, priorKeys),
  };
}

export class AdminSaleOverviewKpiTrendService implements IAdminSaleOverviewKpiTrendService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly trendReader: ISaleOverviewKpiTrendReader,
  ) {}

  async getTrends(
    saleId: string,
    periodDays: AdminKpiPeriodDays,
  ): Promise<AdminSaleOverviewKpiTrends | null> {
    const sale = await this.saleRepo.findById(saleId);
    if (!sale) return null;

    const { currentKeys, priorKeys, rangeStart } = buildTrendWindows(periodDays);
    if (currentKeys.length === 0) {
      const empty: AdminKpiTrendBundle = { currentTotal: 0, priorTotal: 0, dailyCounts: [] };
      return {
        lots: empty,
        estimate: empty,
        hammer: empty,
        revenue: empty,
        registrations: empty,
        bidders: empty,
      };
    }

    const signals = await this.trendReader.loadAllSignals(saleId, rangeStart);
    const revenueByDay = composeTieredRevenueDailySeries({
      rows: signals.bidVolumeByDayAndLot,
      sale: {
        buyerPremiumRate: sale.buyerPremiumRate,
        buyerPremiumTiers: sale.buyerPremiumTiers ?? null,
      },
    });

    return mapSignalsToBundles(signals, currentKeys, priorKeys, revenueByDay);
  }
}
