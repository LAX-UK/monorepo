import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminInvitationsListSummary } from "@/lib/data/http/invitations.shared";

export function buildInvitationsListKpiTiles(summary: AdminInvitationsListSummary): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Total invitations", summary.total, 30, {
      compareHint: "Org-wide",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Pending", summary.pending, 30, {
      compareHint: "Org-wide",
      semanticTone: summary.pending > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Accepted", summary.accepted, 30, {
      compareHint: "Org-wide",
      trendTone: "success",
    }),
  ];
}

export function buildInvitationsMobileMetrics(summary: AdminInvitationsListSummary) {
  return [
    { id: "total", label: "Total invitations", value: String(summary.total) },
    { id: "pending", label: "Pending", value: String(summary.pending) },
    { id: "accepted", label: "Accepted", value: String(summary.accepted) },
  ];
}
