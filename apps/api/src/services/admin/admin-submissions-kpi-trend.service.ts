import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import type { ICreatedAtDailyCountRepository } from "../interfaces/created-at-daily-count.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

export type { AdminKpiTrendBundle } from "../interfaces/admin-kpi-trend.js";

/** Counts new submissions per UTC day (delegates to item-submission repository). */
export class AdminSubmissionsKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(submissionRepository: ICreatedAtDailyCountRepository) {
    this.engine = new AdminKpiTrendEngine((rangeStart) =>
      submissionRepository.countCreatedAtByDay(rangeStart),
    );
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
