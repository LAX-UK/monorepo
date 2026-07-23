import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

/** Counts lots that ended per UTC day (by endTime). */
export class AdminLotsEndedKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(lotRepository: Pick<ILotRepository, "countEndedAtByDay">) {
    this.engine = new AdminKpiTrendEngine((rangeStart) =>
      lotRepository.countEndedAtByDay(rangeStart),
    );
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
