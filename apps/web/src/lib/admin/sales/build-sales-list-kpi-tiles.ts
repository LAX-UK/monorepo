import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminSalesListSummary } from "@/lib/data/http/admin-sales-summary.server";
import { formatMoney } from "@/lib/ui/format";

type Input = {
  summary: AdminSalesListSummary;
  salesTrend: AdminKpiTrendBundle;
  salesHammerTrend: AdminKpiTrendBundle;
  periodDays: AdminKpiPeriodDays;
};

/** Figma-aligned 6-tile sales list KPI band — every tile includes sparkline + delta rhythm. */
export function buildSalesListKpiTiles({
  summary,
  salesTrend,
  salesHammerTrend,
  periodDays,
}: Input): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Active sales", summary.activeCount, periodDays, {
      compareHint: `${summary.upcomingCount} upcoming`,
      semanticTone: summary.activeCount > 0 ? "emphasis" : "default",
      trendTone: "live-red",
    }),
    buildTrendKpiTile("New sales", salesTrend, periodDays, {
      emphasize: true,
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Upcoming sales", summary.upcomingCount, periodDays, {
      compareHint: "Scheduled to open",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Draft sales", summary.draftCount, periodDays, {
      compareHint: `${summary.lensCounts.setup} need setup`,
      semanticTone: summary.lensCounts.setup > 0 ? "warning" : "default",
      trendTone: "lot-orange",
    }),
    buildSnapshotKpiTile("Completed sales", summary.completedCount, periodDays, {
      compareHint: `${summary.lensCounts.closed} closed`,
      trendTone: "muted",
    }),
    buildTrendKpiTile("Total hammer value", salesHammerTrend, periodDays, {
      formatValue: () => formatMoney(summary.totalHammerValue),
      trendTone: "accent-gold",
    }),
  ];
}
