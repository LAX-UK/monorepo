import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { CONDITION_REPORT_LENS_LABELS } from "@/lib/admin/filter-chips/condition-reports";
import type { AdminConditionReportListSummary } from "@/lib/data/http/admin-condition-reports.shared";

export function buildConditionReportsListKpiTiles(input: {
  summary: AdminConditionReportListSummary;
  activeLensId: string;
  matchingTotal: number;
}): KpiRowTile[] {
  const { summary, activeLensId, matchingTotal } = input;
  return [
    buildSnapshotKpiTile("Open requests", summary.open, 30, {
      compareHint: "Pending + in progress",
      semanticTone: summary.open > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Matching lens", matchingTotal, 30, {
      compareHint: CONDITION_REPORT_LENS_LABELS[activeLensId] ?? activeLensId,
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("All requests", summary.total, 30, {
      compareHint: `${summary.fulfilled} fulfilled`,
      trendTone: "muted",
    }),
  ];
}

export function buildConditionReportsMobileMetrics(input: {
  summary: AdminConditionReportListSummary;
  matchingTotal: number;
  pageCount: number;
}) {
  const { summary, matchingTotal, pageCount } = input;
  return [
    { id: "open", label: "Open", value: String(summary.open) },
    { id: "total", label: "Matching", value: String(matchingTotal) },
    ...(pageCount > 0 ? [{ id: "page", label: "On page", value: String(pageCount) }] : []),
  ];
}
