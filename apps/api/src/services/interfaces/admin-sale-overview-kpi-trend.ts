import type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "./admin-kpi-trend.js";

export type AdminSaleOverviewKpiTrends = {
  lots: AdminKpiTrendBundle;
  estimate: AdminKpiTrendBundle;
  hammer: AdminKpiTrendBundle;
  revenue: AdminKpiTrendBundle;
  registrations: AdminKpiTrendBundle;
  bidders: AdminKpiTrendBundle;
};

export interface IAdminSaleOverviewKpiTrendService {
  getTrends(
    saleId: string,
    periodDays: AdminKpiPeriodDays,
  ): Promise<AdminSaleOverviewKpiTrends | null>;
}
