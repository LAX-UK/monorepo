import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { kpiWithTrend } from "@/lib/admin/kpi-with-trend.vm";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";

export type KpiTrendOverlay = Pick<
  DetailBoardKpiTile,
  "trend" | "deltaPercent" | "deltaDirection" | "compareHint"
>;

/** Merge period trend/delta onto a snapshot KPI tile without replacing display value. */
export function applyKpiTrendOverlay(
  bundle: AdminKpiTrendBundle,
  periodDays: AdminKpiPeriodDays,
): KpiTrendOverlay {
  const fields = kpiWithTrend({
    currentCount: bundle.currentTotal,
    priorPeriodCount: bundle.priorTotal,
    dailySeries: bundle.dailyCounts,
    periodDays,
  });
  return {
    trend: fields.trend,
    deltaPercent: fields.deltaPercent,
    deltaDirection: fields.deltaDirection === "flat" ? "neutral" : fields.deltaDirection,
    compareHint: fields.compareHint,
  };
}
