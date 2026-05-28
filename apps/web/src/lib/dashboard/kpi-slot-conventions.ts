/**
 * Dashboard KPI secondary slot conventions:
 * - `delta` / structured delta fields → status or numeric change
 * - `compareHint` → timeframe, scope, or supporting context ("All time", "On this page")
 * - `trendSlot` → actions or custom visualization only (links, sparklines)
 *
 * Pages with active filters should pass compareHint when filtered count differs from total
 * (portfolio, overview KPI rows, in-sale metrics).
 */
import type { KpiTileProps } from "@auction/ui";

export type DashboardKpiSecondarySlots = Pick<
  KpiTileProps,
  "delta" | "deltaTone" | "deltaDirection" | "deltaPercent" | "compareHint" | "trendSlot"
>;

/** Returns a compareHint slot for KPI tiles (scope, timeframe, or filter context). */
export function kpiCompareHint(hint: string): Pick<KpiTileProps, "compareHint"> {
  return { compareHint: hint };
}
