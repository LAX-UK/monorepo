import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { RoleKpiDefinitionId, RoleKpiTile } from "@/lib/admin/dashboard/role-kpis.slice";
import type {
  AdminHomeKpiTrends,
  AdminKpiTrendBundle,
} from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin-ops-dashboard.types";
import { METRIC_STRIP_MAX, type Metric, formatStaffMoney, metricChange } from "@auction/staff-ui";

const COUNT = new Intl.NumberFormat("en-GB");

type Input = {
  periodDays: AdminKpiPeriodDays;
  tiles: readonly RoleKpiTile[];
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  /** Numbers the anomaly checks flagged as out of the ordinary. */
  flagged?: Partial<Record<RoleKpiDefinitionId, "warning">>;
};

/** A period count with its daily series and its change against the period before. */
function periodTrend(
  bundle: AdminKpiTrendBundle,
  what: string,
  periodDays: AdminKpiPeriodDays,
  rise: "good" | "bad" | "neutral",
): Pick<Metric, "value" | "trend" | "trendLabel" | "comparison"> {
  const days = bundle.dailyCounts.length;
  const change = metricChange({
    current: bundle.currentTotal,
    prior: bundle.priorTotal,
    basis: `vs previous ${periodDays} days`,
    rise,
  });
  return {
    value: COUNT.format(bundle.currentTotal),
    ...(days > 1 ? { trend: bundle.dailyCounts, trendLabel: `${what}, last ${days} days` } : {}),
    ...(change ? { comparison: change } : {}),
  };
}

/** Pounds as the API sends them ("1250.5") in full: "£1,250.50". */
function pounds(raw: string): string {
  const value = Number.parseFloat(raw);
  return formatStaffMoney(Math.round((Number.isFinite(value) ? value : 0) * 100));
}

/**
 * The Overview's numbers for this person's role: at most four, each linking to the list behind
 * it. Counts over the period carry their daily trend and change; numbers that mean work is
 * waiting are toned as attention when they are above zero or were flagged.
 */
export function dashboardMetrics({
  periodDays,
  tiles,
  metrics,
  trends,
  bidsPerMinute,
  flagged = {},
}: Input): Metric[] {
  const build = (tile: RoleKpiTile): Metric | null => {
    if (!tile.available) return null;
    const href = tile.drillDownHref ? { href: tile.drillDownHref } : {};
    const attention = flagged[tile.id] === "warning";
    switch (tile.id) {
      case "live-lots":
        return {
          id: tile.id,
          label: "Live lots",
          value: COUNT.format(metrics.liveLots),
          tone: metrics.liveLots > 0 ? "positive" : "neutral",
          ...href,
        };
      case "new-lots":
        return {
          id: tile.id,
          label: "New lots",
          ...periodTrend(trends.lots, "Lots added each day", periodDays, "good"),
          ...(attention ? { tone: "attention" as const } : {}),
          ...href,
        };
      case "submissions":
        return {
          id: tile.id,
          label: "Submissions",
          ...periodTrend(trends.submissions, "Submissions each day", periodDays, "good"),
          ...(attention ? { tone: "attention" as const } : {}),
          ...href,
        };
      case "payments":
        return {
          id: tile.id,
          label: "Payments",
          ...periodTrend(trends.payments, "Payments each day", periodDays, "good"),
          ...(attention ? { tone: "attention" as const } : {}),
          ...href,
        };
      case "stale-payments":
        return {
          id: tile.id,
          label: "Payments pending over 48 hours",
          value: COUNT.format(metrics.stalePendingPayments),
          tone: metrics.stalePendingPayments > 0 || attention ? "attention" : "neutral",
          ...href,
        };
      case "revenue-today":
        return {
          id: tile.id,
          label: "Captured today",
          value: pounds(metrics.revenueToday),
          ...(attention ? { tone: "attention" as const } : {}),
          ...href,
        };
      case "bids-per-minute":
        return {
          id: tile.id,
          label: "Bids per minute",
          value: COUNT.format(bidsPerMinute),
          ...href,
        };
      default:
        return null;
    }
  };
  return tiles
    .map(build)
    .filter((metric): metric is Metric => metric !== null)
    .slice(0, METRIC_STRIP_MAX);
}

/** What the numbers cover: counts are now, the trends and changes cover the period. */
export function dashboardMetricsPeriod(periodDays: AdminKpiPeriodDays): string {
  return `Now, with trends over the last ${periodDays} days`;
}
