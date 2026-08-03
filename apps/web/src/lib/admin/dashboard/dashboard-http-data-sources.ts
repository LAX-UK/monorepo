import "server-only";

import type { DashboardDataSources } from "@/lib/admin/dashboard/dashboard-data-sources";
import { getAdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { getAdminSaleReadiness } from "@/lib/data/http/admin-sale-readiness.server";
import { getAdminSaleroomOperationsRadar } from "@/lib/data/http/admin-telephone.server";
import { getAdminWorkItems } from "@/lib/data/http/admin-work-items.server";
import {
  getAdminFinanceIssues,
  getAdminLotList,
  getAdminMetricsLive,
  getAdminMetricsToday,
} from "@/lib/data/http/admin.server";

/** Production HTTP wiring for staff dashboard slice loaders. */
export const dashboardHttpDataSources: DashboardDataSources = {
  getMetricsToday: getAdminMetricsToday,
  getMetricsLive: getAdminMetricsLive,
  getNavCounts: getAdminNavCounts,
  getFinanceIssues: getAdminFinanceIssues,
  getHomeKpiTrends: getAdminHomeKpiTrends,
  getActiveLots: (limit) => getAdminLotList({ status: "active", limit, sort: "endingAsc" }),
  getRecentLots: (limit) => getAdminLotList({ limit, sort: "endingAsc" }),
  getOperationsRadar: getAdminSaleroomOperationsRadar,
  getWorkItems: getAdminWorkItems,
  getSaleReadiness: getAdminSaleReadiness,
};
