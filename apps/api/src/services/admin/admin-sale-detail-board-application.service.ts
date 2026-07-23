import type { SaleAttentionPrincipal } from "@auction/domain";
import type { AdminKpiPeriodDays } from "../interfaces/admin-kpi-trend.js";
import type { IAdminSaleDetailBoardService } from "../interfaces/admin-routes/admin-detail-board-routes.js";
import type { AdminSaleAttentionService } from "./admin-sale-attention.service.js";
import type { AdminSaleDetailMetricsService } from "./admin-sale-detail-metrics.service.js";
import type { AdminSaleOverviewKpiTrendService } from "./admin-sale-overview-kpi-trend.service.js";

export class AdminSaleDetailBoardApplicationService implements IAdminSaleDetailBoardService {
  constructor(
    private readonly metrics: AdminSaleDetailMetricsService,
    private readonly kpiTrends: AdminSaleOverviewKpiTrendService,
    private readonly attention: AdminSaleAttentionService,
  ) {}

  getMetrics(saleId: string) {
    return this.metrics.getMetrics(saleId);
  }

  getOverviewKpiTrends(saleId: string, periodDays: AdminKpiPeriodDays) {
    return this.kpiTrends.getTrends(saleId, periodDays);
  }

  getAttention(saleId: string, principal: SaleAttentionPrincipal, options?: { limit?: number }) {
    return this.attention.getAttention(saleId, principal, options);
  }
}
