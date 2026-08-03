import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";

export type DashboardMetricsLoadResult = {
  metrics: AdminTodayMetricsPayload;
  navCounts: AdminNavCounts;
  loadWarning: string | null;
};

/** Loads today metrics and nav counts for KPI summary and anomaly detection. */
export async function loadDashboardMetricsSlice(
  ctx: DashboardLoadContext,
): Promise<DashboardMetricsLoadResult> {
  let metrics: AdminTodayMetricsPayload = {
    liveLots: 0,
    endingWithinHour: 0,
    draftLots: 0,
    pendingSubmissions: 0,
    stalePendingPayments: 0,
    revenueToday: "0",
  };
  let loadWarning: string | null = null;

  try {
    metrics = await ctx.sources.getMetricsToday();
  } catch {
    loadWarning = "Could not load dashboard metrics.";
    recordDashboardSliceFailure({
      slice: "metrics",
      profileId: ctx.profileId,
      retryable: true,
    });
  }

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await ctx.sources.getNavCounts();
  } catch {
    recordDashboardSliceFailure({
      slice: "nav-counts",
      profileId: ctx.profileId,
      retryable: true,
    });
  }

  return {
    metrics,
    navCounts,
    loadWarning,
  };
}
