import "server-only";

import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import {
  type getDashboardProfile,
  resolvePrimaryActionForProfile,
} from "@/lib/admin/dashboard-profile-registry";
import type { DashboardWidgetState } from "@/lib/admin/dashboard-widgets.vm";
import type { DashboardDataSources } from "@/lib/admin/dashboard/dashboard-data-sources";
import { dashboardHttpDataSources } from "@/lib/admin/dashboard/dashboard-http-data-sources";
import { createDashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import type { buildLiveOperationsSlice } from "@/lib/admin/dashboard/live-operations.slice";
import { loadDashboardMetricsSlice } from "@/lib/admin/dashboard/load-dashboard-metrics.slice";
import { loadLiveOperationsSlice } from "@/lib/admin/dashboard/load-live-operations.slice";
import { loadRecentActivitySlice } from "@/lib/admin/dashboard/load-recent-activity.slice";
import { loadRoleKpisSlice } from "@/lib/admin/dashboard/load-role-kpis.slice";
import { loadSaleReadinessSlice } from "@/lib/admin/dashboard/load-sale-readiness.slice";
import { loadWorkInboxSlice } from "@/lib/admin/dashboard/load-work-inbox.slice";
import type { buildRecentActivitySlice } from "@/lib/admin/dashboard/recent-activity.slice";
import type { buildRoleKpisSlice } from "@/lib/admin/dashboard/role-kpis.slice";
import type { buildSaleReadinessSlice } from "@/lib/admin/dashboard/sale-readiness.slice";
import type { buildWorkInboxSlice } from "@/lib/admin/dashboard/work-inbox.slice";
import type { OnsiteSalesRadarRow } from "@/lib/admin/saleroom/map-operations-snapshot-to-radar-row";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import { FINANCE_ACCESS, type UserRole, type UserStaffRole } from "@auction/types";

export type AdminDashboardPageInput = {
  periodDays: AdminKpiPeriodDays;
  role: UserRole;
  staffRole: UserStaffRole | null;
  actorUserId: string;
  workAssignment?: "mine" | "unassigned" | "all";
  widgets: readonly DashboardWidgetState[];
  dataSources?: DashboardDataSources;
};

export type AdminDashboardPageModel = {
  profileId: ReturnType<typeof getDashboardProfile>["id"];
  primaryAction: { href: string; label: string };
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  activeLotIds: string[];
  workInbox: ReturnType<typeof buildWorkInboxSlice>;
  saleReadiness: ReturnType<typeof buildSaleReadinessSlice>;
  liveOperations: ReturnType<typeof buildLiveOperationsSlice>;
  roleKpis: ReturnType<typeof buildRoleKpisSlice>;
  recentActivity: ReturnType<typeof buildRecentActivitySlice>;
  activity: AdminActivityRow[];
  anomalies: ReturnType<typeof detectAnomaliesFromNavCounts>;
  onsiteRadarRows: OnsiteSalesRadarRow[];
  activeSaleroomSessions: number;
  loadWarning: string | null;
};

/** Data/composition boundary for `/admin` home dashboard. */
export async function loadAdminDashboardPage(
  input: AdminDashboardPageInput,
): Promise<AdminDashboardPageModel> {
  const sources = input.dataSources ?? dashboardHttpDataSources;
  const ctx = createDashboardLoadContext({ ...input, sources });
  const profile = ctx.profile;

  const metricsSlice = await loadDashboardMetricsSlice(ctx);
  const workInbox = await loadWorkInboxSlice(ctx, {
    actorUserId: input.actorUserId,
    assignment: input.workAssignment ?? "all",
  });

  const [live, recent] = await Promise.all([
    loadLiveOperationsSlice(ctx),
    loadRecentActivitySlice(ctx),
  ]);

  const saleReadiness = await loadSaleReadinessSlice(ctx, {
    bidsPerMinute: live.bidsPerMinute,
    activeSaleroomSessions: live.onsiteRadarRows.filter((row) => row.isLiveSession).length,
  });

  let loadWarning =
    metricsSlice.loadWarning ??
    live.loadWarning ??
    workInbox.loadWarning ??
    saleReadiness.loadWarning;
  let financeIssues: Awaited<ReturnType<DashboardDataSources["getFinanceIssues"]>> | null = null;
  if (ctx.can(FINANCE_ACCESS)) {
    try {
      financeIssues = await sources.getFinanceIssues();
    } catch {
      recordDashboardSliceFailure({
        slice: "finance-issues",
        profileId: ctx.profileId,
        retryable: true,
      });
      loadWarning ??= "Could not load finance dashboard alerts.";
    }
  }

  const roleKpis = await loadRoleKpisSlice(ctx, {
    metrics: metricsSlice.metrics,
    bidsPerMinute: live.bidsPerMinute,
  });

  const anomalies = detectAnomaliesFromNavCounts(metricsSlice.navCounts, {
    stalePendingPayments: metricsSlice.metrics.stalePendingPayments,
    pendingSubmissions: metricsSlice.metrics.pendingSubmissions,
    failedPayouts: financeIssues?.failedPayoutCount ?? 0,
  });

  const onsiteRadarRows = live.onsiteRadarRows;
  const activeSaleroomSessions = onsiteRadarRows.filter((row) => row.isLiveSession).length;
  const primaryAction = resolvePrimaryActionForProfile(profile, (requirement) =>
    requirement == null ? true : ctx.can(requirement),
  );

  return {
    profileId: profile.id,
    primaryAction,
    metrics: metricsSlice.metrics,
    trends: roleKpis.trends,
    bidsPerMinute: live.bidsPerMinute,
    activeLotIds: live.activeLotIds,
    workInbox: workInbox.slice,
    saleReadiness: saleReadiness.slice,
    liveOperations: live.slice,
    roleKpis: roleKpis.slice,
    recentActivity: recent.slice,
    activity: recent.activity,
    anomalies,
    onsiteRadarRows,
    activeSaleroomSessions,
    loadWarning: loadWarning ?? null,
  };
}
