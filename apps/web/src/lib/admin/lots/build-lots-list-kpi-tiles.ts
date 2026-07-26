import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminLotsListSummary } from "@/lib/data/http/admin-lots-summary.server";

type Input = {
  summary: AdminLotsListSummary;
  lotsTrend: AdminKpiTrendBundle;
  lotsEndedTrend: AdminKpiTrendBundle;
  periodDays: AdminKpiPeriodDays;
};

/** Six-tile lots list KPI band — every tile includes sparkline + delta rhythm. */
export function buildLotsListKpiTiles({
  summary,
  lotsTrend,
  lotsEndedTrend,
  periodDays,
}: Input): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Total lots", summary.lensCounts.all, periodDays, {
      compareHint: `${summary.publishedCount} published`,
      trendTone: "secondary",
    }),
    buildTrendKpiTile("New lots", lotsTrend, periodDays, {
      emphasize: true,
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Live now", summary.liveCount, periodDays, {
      compareHint: `${summary.endingSoonCount} ending soon`,
      semanticTone: summary.liveCount > 0 ? "emphasis" : "default",
      trendTone: "live-red",
    }),
    buildSnapshotKpiTile("Drafts", summary.draftCount, periodDays, {
      compareHint: `${summary.needsAttentionCount} need attention`,
      semanticTone: summary.needsAttentionCount > 0 ? "warning" : "default",
      trendTone: "lot-orange",
    }),
    buildTrendKpiTile("Ended", lotsEndedTrend, periodDays, {
      formatValue: () => String(summary.endedCount),
      trendTone: "muted",
    }),
    buildSnapshotKpiTile("Published", summary.publishedCount, periodDays, {
      compareHint: `${summary.lensCounts.all} total lots`,
      trendTone: "success",
    }),
  ];
}
