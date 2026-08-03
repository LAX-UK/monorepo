import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { RoleKpiDefinitionId } from "@/lib/admin/dashboard/role-kpis.slice";
import type { RoleKpisSlice } from "@/lib/admin/dashboard/role-kpis.slice";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";

function tileFromRoleKpi(
  tile: NonNullable<Extract<RoleKpisSlice, { status: "ready" }>["data"]["tiles"][number]>,
  periodDays: AdminKpiPeriodDays,
  trends: AdminHomeKpiTrends,
  anomalyTones: Partial<Record<RoleKpiDefinitionId, "warning">>,
): KpiRowTile {
  if (tile.id === "new-lots") {
    const built = buildTrendKpiTile(tile.label, trends.lots, periodDays, {
      trendTone: "secondary",
      ...(tile.emphasize ? { emphasize: true } : {}),
    });
    return {
      ...built,
      id: tile.id,
      ...(tile.drillDownHref ? { href: tile.drillDownHref } : {}),
      compareHint: tile.trendSummary ?? tile.compareHint,
    };
  }
  if (tile.id === "submissions" && tile.available) {
    const built = buildTrendKpiTile(tile.label, trends.submissions, periodDays, {
      trendTone: "secondary",
    });
    return {
      ...built,
      id: tile.id,
      ...(tile.drillDownHref ? { href: tile.drillDownHref } : {}),
      compareHint: tile.trendSummary ?? tile.compareHint,
    };
  }
  if (tile.id === "payments" && tile.available) {
    const built = buildTrendKpiTile(tile.label, trends.payments, periodDays, {
      trendTone: "primary",
    });
    return {
      ...built,
      id: tile.id,
      ...(tile.drillDownHref ? { href: tile.drillDownHref } : {}),
      compareHint: tile.trendSummary ?? tile.compareHint,
    };
  }

  return {
    id: tile.id,
    label: tile.label,
    value: tile.value,
    deltaDirection: "flat",
    deltaPercent: "—",
    deltaTone: "neutral",
    compareHint: tile.trendSummary ?? tile.compareHint,
    ...(tile.drillDownHref ? { href: tile.drillDownHref } : {}),
    trend: [],
    trendTone:
      tile.semanticTone === "warning" || anomalyTones[tile.id] === "warning"
        ? "live-red"
        : "primary",
    variant: "dashboard",
    ...(tile.emphasize ? { emphasize: true } : {}),
    ...(tile.semanticTone === "warning" || anomalyTones[tile.id] === "warning"
      ? { semanticTone: "warning" as const }
      : tile.semanticTone
        ? { semanticTone: tile.semanticTone }
        : {}),
  };
}

type BuildArgs = {
  periodDays: AdminKpiPeriodDays;
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  roleKpis?: RoleKpisSlice | undefined;
  anomalyTones?: Partial<Record<RoleKpiDefinitionId, "warning">> | undefined;
};

export function buildDashboardKpiTiles({
  periodDays,
  metrics,
  trends,
  bidsPerMinute,
  roleKpis,
  anomalyTones = {},
}: BuildArgs): KpiRowTile[] {
  if (roleKpis?.status === "ready") {
    return roleKpis.data.tiles
      .filter((tile) => tile.available)
      .map((tile) => tileFromRoleKpi(tile, periodDays, trends, anomalyTones));
  }

  return [
    {
      id: "live-lots",
      label: "Live lots",
      value: String(metrics.liveLots),
      deltaDirection: "flat",
      deltaPercent: "—",
      deltaTone: "neutral",
      compareHint: `${metrics.endingWithinHour} ending < 1h`,
      emphasize: true,
      href: "/admin/lots?status=active",
      trend: [],
      trendTone: "primary",
      variant: "dashboard",
    },
    {
      ...buildTrendKpiTile("New lots", trends.lots, periodDays, { trendTone: "secondary" }),
      id: "new-lots",
      href: "/admin/lots",
    },
    {
      ...buildTrendKpiTile("Payments", trends.payments, periodDays, { trendTone: "primary" }),
      id: "payments",
      href: "/admin/payments",
    },
    {
      id: "stale-payments",
      label: "Stale payments",
      value: String(metrics.stalePendingPayments),
      deltaDirection: "flat",
      deltaPercent: "—",
      deltaTone: "neutral",
      compareHint: "Pending > 48h",
      href: "/admin/payments?manualReview=1",
      trend: [],
      trendTone: "live-red",
      semanticTone:
        metrics.stalePendingPayments > 0 || anomalyTones["stale-payments"] === "warning"
          ? "warning"
          : "default",
      variant: "dashboard",
    },
    {
      id: "revenue-today",
      label: "Revenue today",
      value: metrics.revenueToday,
      deltaDirection: "flat",
      deltaPercent: "—",
      deltaTone: "neutral",
      compareHint: "Captured UTC",
      href: "/admin/finance",
      trend: [],
      trendTone: "primary",
      variant: "dashboard",
    },
    {
      id: "bids-per-minute",
      label: "Bids/min",
      value: String(bidsPerMinute),
      deltaDirection: "flat",
      deltaPercent: "—",
      deltaTone: "neutral",
      compareHint: `${metrics.endingWithinHour} ending < 1h`,
      href: "/admin/saleroom",
      trend: [],
      trendTone: "lot-orange",
      variant: "dashboard",
    },
  ];
}
