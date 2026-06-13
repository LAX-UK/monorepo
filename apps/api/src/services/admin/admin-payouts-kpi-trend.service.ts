import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import type { ICreatedAtDailyCountRepository } from "../interfaces/created-at-daily-count.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

export class AdminPayoutsKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(payoutRepository: ICreatedAtDailyCountRepository) {
    this.engine = new AdminKpiTrendEngine((rangeStart) =>
      payoutRepository.countCreatedAtByDay(rangeStart),
    );
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
