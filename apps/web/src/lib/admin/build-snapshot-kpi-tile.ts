import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { kpiWithTrend } from "@/lib/admin/kpi-with-trend.vm";
import type { KpiTileTone } from "@auction/ui/components/kpi-tile";

type SnapshotOpts = {
  compareHint?: string;
  emphasize?: boolean;
  semanticTone?: KpiRowTile["semanticTone"];
  trendTone?: KpiTileTone;
};

/**
 * KPI tile for snapshot counts without a dedicated trend API.
 * Uses a flat period series so every tile shares sparkline + delta rhythm.
 */
export function buildSnapshotKpiTile(
  label: string,
  count: number,
  periodDays: number,
  opts?: SnapshotOpts,
): KpiRowTile {
  const dailySeries = Array.from({ length: periodDays }, () => count);
  const trend = kpiWithTrend({
    currentCount: count,
    priorPeriodCount: count,
    dailySeries,
    periodDays,
    formatValue: (n) => String(n),
  });

  return {
    label,
    value: String(count),
    compareHint: opts?.compareHint ?? trend.compareHint,
    trend: trend.trend,
    deltaDirection: trend.deltaDirection,
    deltaPercent: trend.deltaPercent,
    deltaTone: trend.deltaTone,
    variant: "dashboard" as const,
    ...(opts?.emphasize ? { emphasize: opts.emphasize } : {}),
    ...(opts?.semanticTone ? { semanticTone: opts.semanticTone } : {}),
    ...(opts?.trendTone ? { trendTone: opts.trendTone } : {}),
  };
}
