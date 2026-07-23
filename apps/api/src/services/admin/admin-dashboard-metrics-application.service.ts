import type {
  AdminKpiPeriodDays,
  IAdminCatalogListSummariesQueryService,
  IAdminDashboardMetricsService,
  IAdminKpiTrendsQueryService,
  IAdminNavCountsQueryService,
} from "../interfaces/admin-routes.js";
import type { AdminLotsEndedKpiTrendService } from "./admin-lots-ended-kpi-trend.service.js";
import type { AdminLotsHammerKpiTrendService } from "./admin-lots-hammer-kpi-trend.service.js";
import type { AdminLotsKpiTrendService } from "./admin-lots-kpi-trend.service.js";
import type { AdminLotsListSummaryService } from "./admin-lots-list-summary.service.js";
import type { AdminNavCountsService } from "./admin-nav-counts.service.js";
import type { AdminPaymentsKpiTrendService } from "./admin-payments-kpi-trend.service.js";
import type { AdminPayoutsKpiTrendService } from "./admin-payouts-kpi-trend.service.js";
import type { AdminSalesKpiTrendService } from "./admin-sales-kpi-trend.service.js";
import type { AdminSalesListSummaryService } from "./admin-sales-list-summary.service.js";
import type { AdminSubmissionsListSummaryService } from "./admin-submissions-list-summary.service.js";

export class AdminDashboardMetricsApplicationService
  implements
    IAdminDashboardMetricsService,
    IAdminNavCountsQueryService,
    IAdminKpiTrendsQueryService,
    IAdminCatalogListSummariesQueryService
{
  constructor(
    private readonly navCounts: AdminNavCountsService,
    private readonly lotsKpiTrend: AdminLotsKpiTrendService,
    private readonly lotsEndedKpiTrend: AdminLotsEndedKpiTrendService,
    private readonly lotsHammerKpiTrend: AdminLotsHammerKpiTrendService,
    private readonly paymentsKpiTrend: AdminPaymentsKpiTrendService,
    private readonly salesKpiTrend: AdminSalesKpiTrendService,
    private readonly payoutsKpiTrend: AdminPayoutsKpiTrendService,
    private readonly salesListSummary: AdminSalesListSummaryService,
    private readonly lotsListSummary: AdminLotsListSummaryService,
    private readonly submissionsListSummary: AdminSubmissionsListSummaryService,
  ) {}

  getNavCounts() {
    return this.navCounts.getCounts();
  }

  getLotsTrend(periodDays: AdminKpiPeriodDays) {
    return this.lotsKpiTrend.getTrend(periodDays);
  }

  getLotsEndedTrend(periodDays: AdminKpiPeriodDays) {
    return this.lotsEndedKpiTrend.getTrend(periodDays);
  }

  getLotsHammerTrend(periodDays: AdminKpiPeriodDays) {
    return this.lotsHammerKpiTrend.getTrend(periodDays);
  }

  getPaymentsTrend(periodDays: AdminKpiPeriodDays) {
    return this.paymentsKpiTrend.getTrend(periodDays);
  }

  getSalesTrend(periodDays: AdminKpiPeriodDays) {
    return this.salesKpiTrend.getTrend(periodDays);
  }

  getPayoutsTrend(periodDays: AdminKpiPeriodDays) {
    return this.payoutsKpiTrend.getTrend(periodDays);
  }

  getSalesListSummary() {
    return this.salesListSummary.getSummary();
  }

  getLotsListSummary() {
    return this.lotsListSummary.getSummary();
  }

  getSubmissionsListSummary(userId: string) {
    return this.submissionsListSummary.getSummary(userId);
  }
}
