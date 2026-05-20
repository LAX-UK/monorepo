import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { kpiWithTrend } from "@/lib/admin/kpi-with-trend.vm";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import type { KpiTileTone } from "@auction/ui/components/kpi-tile";

export function buildTrendKpiTile(
  label: string,
  bundle: AdminKpiTrendBundle,
  periodDays: number,
  opts?: {
    formatValue?: (n: number) => string;
    higherIsBetter?: boolean;
    trendTone?: KpiTileTone;
    emphasize?: boolean;
    semanticTone?: KpiRowTile["semanticTone"];
  },
): KpiRowTile {
  const trend = kpiWithTrend({
    currentCount: bundle.currentTotal,
    priorPeriodCount: bundle.priorTotal,
    dailySeries: bundle.dailyCounts,
    periodDays,
    ...(opts?.formatValue ? { formatValue: opts.formatValue } : {}),
    ...(opts?.higherIsBetter !== undefined ? { higherIsBetter: opts.higherIsBetter } : {}),
  });
  return {
    label,
    value: trend.value,
    deltaDirection: trend.deltaDirection,
    deltaPercent: trend.deltaPercent,
    deltaTone: trend.deltaTone,
    compareHint: trend.compareHint,
    trend: trend.trend,
    ...(opts?.trendTone ? { trendTone: opts.trendTone } : {}),
    ...(opts?.emphasize ? { emphasize: opts.emphasize } : {}),
    ...(opts?.semanticTone ? { semanticTone: opts.semanticTone } : {}),
  };
}
