import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { AdminAnomaly } from "@/lib/admin/anomaly-detection";
import type { AdminHomeKpiTrendsOptions } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.types";
import type { AdminSaleReadinessRow } from "@/lib/data/http/admin-sale-readiness.schema";
import type { AdminWorkItemsResponse } from "@/lib/data/http/admin-work-items.schema";
import type { AdminWorkItemsQuery } from "@/lib/data/http/admin-work-items.server";
import type {
  AdminFinanceIssuesPayload,
  AdminTodayMetricsPayload,
} from "@/lib/data/http/admin.server";

type RecentLotRow = {
  id: string;
  title: string;
  status: string;
  endTime: string | Date;
  winnerId?: string | null;
  currentPrice: string;
};

/** Narrow data-source port for staff dashboard slice loaders (DIP). */
export type DashboardDataSources = {
  getMetricsToday(): Promise<AdminTodayMetricsPayload>;
  getMetricsLive(): Promise<{ bidsPerMinute: number }>;
  getNavCounts(): Promise<AdminNavCounts>;
  getFinanceIssues(): Promise<AdminFinanceIssuesPayload | null>;
  getHomeKpiTrends(
    periodDays: AdminKpiPeriodDays,
    options?: AdminHomeKpiTrendsOptions,
  ): Promise<AdminHomeKpiTrends>;
  getActiveLots(limit: number): Promise<readonly RecentLotRow[]>;
  getRecentLots(limit: number): Promise<readonly RecentLotRow[]>;
  getOperationsRadar(limit: number): Promise<readonly AdminSaleOperationsSnapshot[]>;
  getWorkItems(query?: AdminWorkItemsQuery): Promise<AdminWorkItemsResponse>;
  getSaleReadiness(limit?: number): Promise<readonly AdminSaleReadinessRow[]>;
};

export type DashboardRawActivity = AdminActivityRow[];
export type DashboardRawAnomalies = AdminAnomaly[];
