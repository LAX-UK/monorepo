import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { KpiRowTile } from "@/lib/admin/kpi-row-tile.types";
import type { AdminAmlListSummary } from "@/lib/data/http/compliance-aml.shared";

export function buildAmlListKpiTiles(summary: AdminAmlListSummary): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Awaiting triage", summary.awaitingTriage, 30, {
      compareHint: "Needs analyst review",
      semanticTone: summary.awaitingTriage > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("Triaged", summary.triaged, 30, {
      compareHint: "Awaiting MLRO decision",
      trendTone: "info",
    }),
    buildSnapshotKpiTile("Escalated", summary.escalated, 30, {
      compareHint: "Risk overlay (subset of triage buckets)",
      semanticTone: summary.escalated > 0 ? "danger" : "default",
      trendTone: "live-red",
    }),
    buildSnapshotKpiTile("Total pending", summary.total, 30, {
      compareHint: "Across active filters",
      emphasize: true,
      trendTone: "primary",
    }),
  ];
}

export function buildAmlMobileMetrics(summary: AdminAmlListSummary) {
  return [
    { id: "pending", label: "Awaiting triage", value: String(summary.awaitingTriage) },
    { id: "triaged", label: "Triaged", value: String(summary.triaged) },
    { id: "total", label: "Total pending", value: String(summary.total) },
  ];
}
