import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "../interfaces/admin-kpi-trend.js";
import { buildTrendWindows, bundleFromDailyCounts } from "./admin-kpi-trend.helpers.js";

export type AdminLotOverviewKpiTrends = {
  hammer: AdminKpiTrendBundle;
  bids: AdminKpiTrendBundle;
  bidders: AdminKpiTrendBundle;
};

export interface IAdminLotOverviewKpiTrendService {
  getTrends(
    lotId: string,
    periodDays: AdminKpiPeriodDays,
  ): Promise<AdminLotOverviewKpiTrends | null>;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function aggregateBidsByDay(
  bids: readonly { createdAt: Date; amount: string; bidderId?: string | null }[],
): {
  amountByDay: Map<string, number>;
  countByDay: Map<string, number>;
  biddersByDay: Map<string, Set<string>>;
} {
  const amountByDay = new Map<string, number>();
  const countByDay = new Map<string, number>();
  const biddersByDay = new Map<string, Set<string>>();

  for (const bid of bids) {
    const key = utcDayKey(bid.createdAt);
    const amount = Number.parseFloat(bid.amount);
    if (!Number.isNaN(amount)) {
      amountByDay.set(key, Math.max(amountByDay.get(key) ?? 0, amount));
    }
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    const set = biddersByDay.get(key) ?? new Set<string>();
    if (bid.bidderId) set.add(bid.bidderId);
    biddersByDay.set(key, set);
  }

  return { amountByDay, countByDay, biddersByDay };
}

export class AdminLotOverviewKpiTrendService implements IAdminLotOverviewKpiTrendService {
  constructor(
    private readonly lotRepo: ILotRepository,
    private readonly bidRepo: IBidRepository,
  ) {}

  async getTrends(
    lotId: string,
    periodDays: AdminKpiPeriodDays,
  ): Promise<AdminLotOverviewKpiTrends | null> {
    const lot = await this.lotRepo.findById(lotId);
    if (!lot) return null;

    const { currentKeys, priorKeys, rangeStart } = buildTrendWindows(periodDays);
    const empty: AdminKpiTrendBundle = { currentTotal: 0, priorTotal: 0, dailyCounts: [] };

    if (currentKeys.length === 0) {
      return { hammer: empty, bids: empty, bidders: empty };
    }

    const bids = await this.bidRepo.listForLot(lotId, 500);
    const inRange = bids.filter((b) => b.createdAt >= rangeStart);
    const { amountByDay, countByDay, biddersByDay } = aggregateBidsByDay(inRange);

    const biddersCountByDay = new Map<string, number>();
    for (const [day, set] of biddersByDay) {
      biddersCountByDay.set(day, set.size);
    }

    return {
      hammer: bundleFromDailyCounts(amountByDay, currentKeys, priorKeys),
      bids: bundleFromDailyCounts(countByDay, currentKeys, priorKeys),
      bidders: bundleFromDailyCounts(biddersCountByDay, currentKeys, priorKeys),
    };
  }
}
