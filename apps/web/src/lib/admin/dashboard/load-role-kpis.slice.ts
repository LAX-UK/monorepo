import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import { type RoleKpisSlice, buildRoleKpisSlice } from "@/lib/admin/dashboard/role-kpis.slice";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import {
  ADMIN_DASHBOARD_ACCESS,
  FINANCE_ACCESS,
  SUBMISSIONS_ACCESS,
  canAccessPlatformAdminRoutes,
} from "@auction/types";

export type RoleKpisLoadResult = {
  slice: RoleKpisSlice;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
};

const EMPTY_TRENDS = (periodDays: number): AdminHomeKpiTrends => ({
  lots: {
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: Array.from({ length: periodDays }, () => 0),
  },
  submissions: {
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: Array.from({ length: periodDays }, () => 0),
  },
  payments: {
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: Array.from({ length: periodDays }, () => 0),
  },
});

/** Loads role KPI tiles and trend bundles; transport failures become unavailable slices. */
export async function loadRoleKpisSlice(
  ctx: DashboardLoadContext,
  input: {
    metrics: AdminTodayMetricsPayload;
    bidsPerMinute: number;
  },
): Promise<RoleKpisLoadResult> {
  // Each trend is asked for only when the API will answer this person. The trends live on the
  // platform admin routes, which the finance shell cannot reach, so it never triggers refused
  // requests; within the platform shell each trend follows its own permission.
  const onPlatformShell = canAccessPlatformAdminRoutes(ctx.role, ctx.staffRole);
  const includeLots = onPlatformShell && ctx.can(ADMIN_DASHBOARD_ACCESS);
  const includeSubmissions = onPlatformShell && ctx.can(SUBMISSIONS_ACCESS);
  const includePayments = onPlatformShell && ctx.can(FINANCE_ACCESS);

  let trends = EMPTY_TRENDS(ctx.periodDays);
  try {
    trends = await ctx.sources.getHomeKpiTrends(ctx.periodDays, {
      includeLots,
      includeSubmissions,
      includePayments,
      includeLiveLots: ctx.profile.kpiIds.includes("live-lots"),
    });
  } catch {
    recordDashboardSliceFailure({
      slice: "role-kpis",
      profileId: ctx.profileId,
      retryable: true,
    });
    return {
      slice: {
        status: "unavailable",
        message: "KPI summaries could not load. Queue and live data remain available.",
        retryable: true,
      },
      trends,
      bidsPerMinute: input.bidsPerMinute,
    };
  }

  const slice = buildRoleKpisSlice({
    periodDays: ctx.periodDays,
    metrics: input.metrics,
    trends,
    bidsPerMinute: input.bidsPerMinute,
    kpiIds: ctx.profile.kpiIds,
    submissionsAvailable: includeSubmissions,
    paymentsAvailable: includePayments,
  });

  return {
    slice,
    trends,
    bidsPerMinute: input.bidsPerMinute,
  };
}
