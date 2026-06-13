import type {
  AdminKpiPeriodDays,
  AdminKpiTrendBundle,
  IAdminKpiTrendService,
} from "../interfaces/admin-kpi-trend.js";
import type { CreatedAtDailyCountFn } from "../interfaces/created-at-daily-count.js";
import { buildTrendWindows, bundleFromDailyCounts } from "./admin-kpi-trend.helpers.js";

/** Shared UTC day-window math; entity services supply countCreatedAtByDay only. */
export class AdminKpiTrendEngine implements IAdminKpiTrendService {
  constructor(private readonly countCreatedAtByDay: CreatedAtDailyCountFn) {}

  async getTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle> {
    const { currentKeys, priorKeys, rangeStart } = buildTrendWindows(periodDays);
    if (currentKeys.length === 0) {
      return { currentTotal: 0, priorTotal: 0, dailyCounts: [] };
    }

    const countsByDay = await this.countCreatedAtByDay(rangeStart);
    return bundleFromDailyCounts(countsByDay, currentKeys, priorKeys);
  }
}
