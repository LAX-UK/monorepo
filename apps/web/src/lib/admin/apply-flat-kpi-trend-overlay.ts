import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { KpiTrendOverlay } from "@/lib/admin/apply-kpi-trend-overlay";
import { kpiWithTrend } from "@/lib/admin/kpi-with-trend.vm";

/** Flat sparkline overlay when no period trend API exists (visual parity with trend tiles). */
export function applyFlatKpiTrendOverlay(
  snapshotValue: number,
  periodDays: AdminKpiPeriodDays,
): KpiTrendOverlay {
  const dailySeries = Array.from({ length: periodDays }, () => snapshotValue);
  const fields = kpiWithTrend({
    currentCount: snapshotValue,
    priorPeriodCount: snapshotValue,
    dailySeries,
    periodDays,
  });
  return {
    trend: fields.trend,
    deltaPercent: fields.deltaPercent,
    deltaDirection: "neutral",
    compareHint: fields.compareHint,
  };
}
