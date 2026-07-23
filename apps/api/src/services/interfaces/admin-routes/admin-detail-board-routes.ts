import type {
  LotAttentionPrincipal,
  LotAttentionResult,
  SaleAttentionPrincipal,
  SaleAttentionResult,
} from "@auction/domain";
import type { AdminLotDetailMetrics } from "../../admin/admin-lot-detail-metrics.service.js";
import type { AdminLotOverviewKpiTrends } from "../../admin/admin-lot-overview-kpi-trend.service.js";
import type { AdminSaleDetailMetrics } from "../../admin/admin-sale-detail-metrics.service.js";
import type { AdminKpiPeriodDays } from "../admin-kpi-trend.js";
import type { AdminSaleOverviewKpiTrends } from "../admin-sale-overview-kpi-trend.js";

export interface IAdminSaleDetailBoardService {
  getMetrics(saleId: string): Promise<AdminSaleDetailMetrics>;
  getOverviewKpiTrends(
    saleId: string,
    periodDays: AdminKpiPeriodDays,
  ): Promise<AdminSaleOverviewKpiTrends | null>;
  getAttention(
    saleId: string,
    principal: SaleAttentionPrincipal,
    options?: { limit?: number },
  ): Promise<SaleAttentionResult>;
}

export interface IAdminLotDetailBoardService {
  getMetrics(lotId: string): Promise<AdminLotDetailMetrics | null>;
  getOverviewKpiTrends(
    lotId: string,
    periodDays: AdminKpiPeriodDays,
  ): Promise<AdminLotOverviewKpiTrends | null>;
  getAttention(
    lotId: string,
    principal: LotAttentionPrincipal,
    options?: { limit?: number },
  ): Promise<LotAttentionResult>;
}

export type AdminDetailBoardRouteServices = {
  saleDetailBoard: IAdminSaleDetailBoardService;
  lotDetailBoard: IAdminLotDetailBoardService;
};
