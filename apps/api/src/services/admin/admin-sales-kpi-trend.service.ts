import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import type { ICreatedAtDailyCountRepository } from "../interfaces/created-at-daily-count.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

export class AdminSalesKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(saleRepository: ICreatedAtDailyCountRepository) {
    this.engine = new AdminKpiTrendEngine((rangeStart) =>
      saleRepository.countCreatedAtByDay(rangeStart),
    );
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
