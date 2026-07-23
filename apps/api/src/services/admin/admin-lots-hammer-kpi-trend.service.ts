import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IAdminKpiTrendService } from "../interfaces/admin-kpi-trend.js";
import { AdminKpiTrendEngine } from "./admin-kpi-trend.engine.js";

/** Sum hammer value (current price) for lots that ended per UTC day (by endTime). */
export class AdminLotsHammerKpiTrendService implements IAdminKpiTrendService {
  private readonly engine: AdminKpiTrendEngine;

  constructor(lotRepository: Pick<ILotRepository, "sumEndedHammerByDay">) {
    this.engine = new AdminKpiTrendEngine((rangeStart) =>
      lotRepository.sumEndedHammerByDay(rangeStart),
    );
  }

  getTrend(...args: Parameters<IAdminKpiTrendService["getTrend"]>) {
    return this.engine.getTrend(...args);
  }
}
