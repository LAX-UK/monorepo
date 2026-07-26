import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminSubmissionsListSummary } from "@/lib/data/http/admin-submissions-summary.server";

type Input = {
  summary: AdminSubmissionsListSummary;
  periodDays: AdminKpiPeriodDays;
  qualityGapsOnPage?: number;
};

/** Six-tile submissions list KPI band — snapshot sparklines (no trend API). */
export function buildSubmissionsListKpiTiles({
  summary,
  periodDays,
  qualityGapsOnPage = 0,
}: Input): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Awaiting review", summary.awaitingReview, periodDays, {
      compareHint: `${summary.queueCounts.awaiting} awaiting review`,
      semanticTone: summary.awaitingReview > 0 ? "emphasis" : "default",
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Assigned to you", summary.assignedToMe, periodDays, {
      compareHint: "Awaiting decision",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Over SLA", summary.overSla, periodDays, {
      compareHint: "> 7 days waiting",
      semanticTone: summary.overSla > 0 ? "warning" : "default",
      trendTone: "lot-orange",
    }),
    buildSnapshotKpiTile("Quality gaps", summary.qualityGaps, periodDays, {
      compareHint: `${qualityGapsOnPage} on page`,
      semanticTone: summary.qualityGaps > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Reviewed today", summary.reviewedToday, periodDays, {
      compareHint: "Staff decisions",
      trendTone: "success",
    }),
    buildSnapshotKpiTile("Rejected today", summary.rejectedToday, periodDays, {
      compareHint: "Terminal rejections",
      trendTone: "muted",
    }),
  ];
}
