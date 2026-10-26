import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

/** Counts lots open for bidding on each UTC day. */
export class AdminLotsLiveKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(lotRepository: Pick<ILotRepository, "countLiveByDay">) {
    this.engine = new AdminKpiTrendEngine((rangeStart) => lotRepository.countLiveByDay(rangeStart));
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
