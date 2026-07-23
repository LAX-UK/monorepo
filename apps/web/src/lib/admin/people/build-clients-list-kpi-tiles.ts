import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminUserListSummary } from "@/lib/data/http/admin-users.shared";

export function buildClientsListKpiTiles(summary: AdminUserListSummary): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Total clients", summary.total, 30, {
      compareHint: "Org-wide",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Active", summary.active, 30, {
      compareHint: "Org-wide",
      trendTone: "success",
    }),
    buildSnapshotKpiTile("Suspended", summary.suspended, 30, {
      compareHint: "Org-wide",
      semanticTone: summary.suspended > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Verified email", summary.emailVerified, 30, {
      compareHint: "Org-wide",
      trendTone: "secondary",
    }),
  ];
}

export function buildClientsMobileMetrics(summary: AdminUserListSummary) {
  return [
    { id: "total", label: "Total clients", value: String(summary.total) },
    { id: "active", label: "Active", value: String(summary.active) },
    { id: "suspended", label: "Suspended", value: String(summary.suspended) },
    { id: "emailVerified", label: "Verified email", value: String(summary.emailVerified) },
  ];
}
