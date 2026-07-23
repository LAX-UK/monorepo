import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminDisputeCaseSummary } from "@auction/types";

export function buildDisputesListKpiTiles(summary: AdminDisputeCaseSummary): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Open", summary.open, 30, {
      compareHint: "Action required",
      semanticTone: summary.open > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Under review", summary.underReview, 30, {
      compareHint: "Evidence in progress",
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Won", summary.won, 30, {
      compareHint: "Closed in our favour",
      trendTone: "success",
    }),
    buildSnapshotKpiTile("Lost", summary.lost, 30, {
      compareHint: "Closed against us",
      semanticTone: summary.lost > 0 ? "danger" : "default",
      trendTone: "live-red",
    }),
  ];
}
