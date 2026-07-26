import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminUserListSummary } from "@/lib/data/http/admin-users.shared";

export function buildStaffListKpiTiles(summary: AdminUserListSummary): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Total staff", summary.total, 30, {
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
    buildSnapshotKpiTile("Staff roles", Object.keys(summary.byStaffRole).length, 30, {
      compareHint: "Distinct roles in filter",
      trendTone: "secondary",
    }),
  ];
}

export function buildStaffMobileMetrics(summary: AdminUserListSummary) {
  return [
    { id: "total", label: "Total staff", value: String(summary.total) },
    { id: "active", label: "Active", value: String(summary.active) },
    { id: "suspended", label: "Suspended", value: String(summary.suspended) },
    { id: "emailVerified", label: "Verified email", value: String(summary.emailVerified) },
  ];
}
