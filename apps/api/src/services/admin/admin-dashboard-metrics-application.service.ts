import type {
  AdminKpiPeriodDays,
  IAdminDashboardMetricsService,
} from "../interfaces/admin-routes.js";
import type { AdminLotsKpiTrendService } from "./admin-lots-kpi-trend.service.js";
import type { AdminNavCountsService } from "./admin-nav-counts.service.js";
import type { AdminPaymentsKpiTrendService } from "./admin-payments-kpi-trend.service.js";
import type { AdminPayoutsKpiTrendService } from "./admin-payouts-kpi-trend.service.js";
import type { AdminSalesKpiTrendService } from "./admin-sales-kpi-trend.service.js";

export class AdminDashboardMetricsApplicationService implements IAdminDashboardMetricsService {
  constructor(
    private readonly navCounts: AdminNavCountsService,
    private readonly lotsKpiTrend: AdminLotsKpiTrendService,
    private readonly paymentsKpiTrend: AdminPaymentsKpiTrendService,
    private readonly salesKpiTrend: AdminSalesKpiTrendService,
    private readonly payoutsKpiTrend: AdminPayoutsKpiTrendService,
  ) {}

  getNavCounts() {
    return this.navCounts.getCounts();
  }

  getLotsTrend(periodDays: AdminKpiPeriodDays) {
    return this.lotsKpiTrend.getTrend(periodDays);
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
}
