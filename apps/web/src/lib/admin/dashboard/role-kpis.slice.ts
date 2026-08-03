import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { DashboardSlice } from "@/lib/admin/dashboard/slice-state";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";

export type RoleKpiDefinitionId =
  | "live-lots"
  | "new-lots"
  | "submissions"
  | "payments"
  | "stale-payments"
  | "revenue-today"
  | "bids-per-minute";

export type RoleKpiTile = {
  id: RoleKpiDefinitionId;
  label: string;
  value: string;
  compareHint: string;
  drillDownHref: string | null;
  trendSummary: string | null;
  available: boolean;
  emphasize?: boolean;
  semanticTone?: "default" | "warning";
};

export type RoleKpisData = {
  periodDays: AdminKpiPeriodDays;
  tiles: RoleKpiTile[];
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
};

export type RoleKpisSlice = DashboardSlice<RoleKpisData>;

export function buildRoleKpisSlice(input: {
  periodDays: AdminKpiPeriodDays;
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  kpiIds: readonly RoleKpiDefinitionId[];
  submissionsAvailable: boolean;
  paymentsAvailable: boolean;
}): RoleKpisSlice {
  const tiles = buildRoleKpiTiles(input);
  const data: RoleKpisData = {
    periodDays: input.periodDays,
    tiles,
    metrics: input.metrics,
    trends: input.trends,
    bidsPerMinute: input.bidsPerMinute,
  };
  if (tiles.every((tile) => !tile.available)) {
    return {
      status: "unavailable",
      message: "KPI summaries are not available for your role.",
      retryable: false,
    };
  }
  return { status: "ready", data };
}

function formatTrendSummary(
  label: string,
  current: number,
  prior: number,
  periodDays: AdminKpiPeriodDays,
): string {
  if (prior === 0 && current === 0) return `${label}: no change over ${periodDays} days`;
  const delta = current - prior;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return `${label}: ${current} in period (${direction} from ${prior} prior)`;
}

export function buildRoleKpiTiles(input: {
  periodDays: AdminKpiPeriodDays;
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  kpiIds: readonly RoleKpiDefinitionId[];
  submissionsAvailable: boolean;
  paymentsAvailable: boolean;
}): RoleKpiTile[] {
  const catalog: Record<RoleKpiDefinitionId, RoleKpiTile> = {
    "live-lots": {
      id: "live-lots",
      label: "Live lots",
      value: String(input.metrics.liveLots),
      compareHint: `${input.metrics.endingWithinHour} ending < 1h`,
      drillDownHref: "/admin/lots?status=active",
      trendSummary: null,
      available: true,
      emphasize: true,
    },
    "new-lots": {
      id: "new-lots",
      label: "New lots",
      value: String(input.trends.lots.currentTotal),
      compareHint: `vs ${input.trends.lots.priorTotal} prior`,
      drillDownHref: "/admin/lots",
      trendSummary: formatTrendSummary(
        "New lots",
        input.trends.lots.currentTotal,
        input.trends.lots.priorTotal,
        input.periodDays,
      ),
      available: true,
    },
    submissions: {
      id: "submissions",
      label: "Submissions",
      value: input.submissionsAvailable ? String(input.trends.submissions.currentTotal) : "—",
      compareHint: input.submissionsAvailable
        ? `vs ${input.trends.submissions.priorTotal} prior`
        : "Not available for your role",
      drillDownHref: input.submissionsAvailable ? "/admin/submissions" : null,
      trendSummary: input.submissionsAvailable
        ? formatTrendSummary(
            "Submissions",
            input.trends.submissions.currentTotal,
            input.trends.submissions.priorTotal,
            input.periodDays,
          )
        : null,
      available: input.submissionsAvailable,
    },
    payments: {
      id: "payments",
      label: "Payments",
      value: input.paymentsAvailable ? String(input.trends.payments.currentTotal) : "—",
      compareHint: input.paymentsAvailable
        ? `vs ${input.trends.payments.priorTotal} prior`
        : "Not available for your role",
      drillDownHref: input.paymentsAvailable ? "/admin/payments" : null,
      trendSummary: input.paymentsAvailable
        ? formatTrendSummary(
            "Payments",
            input.trends.payments.currentTotal,
            input.trends.payments.priorTotal,
            input.periodDays,
          )
        : null,
      available: input.paymentsAvailable,
    },
    "stale-payments": {
      id: "stale-payments",
      label: "Stale payments",
      value: input.paymentsAvailable ? String(input.metrics.stalePendingPayments) : "—",
      compareHint: "Pending > 48h",
      drillDownHref: input.paymentsAvailable ? "/admin/payments?manualReview=1" : null,
      trendSummary: null,
      available: input.paymentsAvailable,
      semanticTone: input.metrics.stalePendingPayments > 0 ? "warning" : "default",
    },
    "revenue-today": {
      id: "revenue-today",
      label: "Revenue today",
      value: input.paymentsAvailable ? input.metrics.revenueToday : "—",
      compareHint: "Captured UTC",
      drillDownHref: input.paymentsAvailable ? "/admin/finance" : null,
      trendSummary: null,
      available: input.paymentsAvailable,
    },
    "bids-per-minute": {
      id: "bids-per-minute",
      label: "Bids/min",
      value: String(input.bidsPerMinute),
      compareHint: `${input.metrics.endingWithinHour} ending < 1h`,
      drillDownHref: "/admin/saleroom",
      trendSummary: `${input.bidsPerMinute} bids per minute right now`,
      available: true,
    },
  };

  return input.kpiIds.map((id) => catalog[id]).filter(Boolean);
}
