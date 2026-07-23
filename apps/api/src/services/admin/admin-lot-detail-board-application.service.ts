import type { LotAttentionPrincipal } from "@auction/domain";
import type { AdminKpiPeriodDays } from "../interfaces/admin-kpi-trend.js";
import type { IAdminLotDetailBoardService } from "../interfaces/admin-routes/admin-detail-board-routes.js";
import type { AdminLotAttentionService } from "./admin-lot-attention.service.js";
import type { AdminLotDetailMetricsService } from "./admin-lot-detail-metrics.service.js";
import type { AdminLotOverviewKpiTrendService } from "./admin-lot-overview-kpi-trend.service.js";

export class AdminLotDetailBoardApplicationService implements IAdminLotDetailBoardService {
  constructor(
    private readonly metrics: AdminLotDetailMetricsService,
    private readonly kpiTrends: AdminLotOverviewKpiTrendService,
    private readonly attention: AdminLotAttentionService,
  ) {}

  getMetrics(lotId: string) {
    return this.metrics.getMetrics(lotId);
  }

  getOverviewKpiTrends(lotId: string, periodDays: AdminKpiPeriodDays) {
    return this.kpiTrends.getTrends(lotId, periodDays);
  }

  getAttention(lotId: string, principal: LotAttentionPrincipal, options?: { limit?: number }) {
    return this.attention.getAttention(lotId, principal, options);
  }
}
