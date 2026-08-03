import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import { type RoleKpisSlice, buildRoleKpisSlice } from "@/lib/admin/dashboard/role-kpis.slice";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import { FINANCE_ACCESS, SUBMISSIONS_ACCESS } from "@auction/types";

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
  const includeSubmissions = ctx.can(SUBMISSIONS_ACCESS);
  const includePayments = ctx.can(FINANCE_ACCESS);

  let trends = EMPTY_TRENDS(ctx.periodDays);
  try {
    trends = await ctx.sources.getHomeKpiTrends(ctx.periodDays, {
      includeSubmissions,
      includePayments,
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
