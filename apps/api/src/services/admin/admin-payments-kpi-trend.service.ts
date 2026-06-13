import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import type { ICreatedAtDailyCountRepository } from "../interfaces/created-at-daily-count.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

export class AdminPaymentsKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(paymentRepository: ICreatedAtDailyCountRepository) {
    this.engine = new AdminKpiTrendEngine((rangeStart) =>
      paymentRepository.countCreatedAtByDay(rangeStart),
    );
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
