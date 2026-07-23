import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminLotFulfilmentListSummary } from "@/lib/data/http/admin-lot-fulfilment.shared";

export function buildLotFulfilmentListKpiTiles(
  summary: AdminLotFulfilmentListSummary,
): KpiRowTile[] {
  return [
    buildSnapshotKpiTile("Active fulfilment", summary.total, 30, {
      compareHint: "Current queue",
      trendTone: "secondary",
    }),
    buildSnapshotKpiTile("Awaiting pickup / release", summary.awaitingPickup, 30, {
      compareHint: "Action required",
      semanticTone: summary.awaitingPickup > 0 ? "warning" : "default",
      trendTone: "accent-gold",
    }),
    buildSnapshotKpiTile("In transit / released", summary.inTransit, 30, {
      compareHint: "In progress",
      trendTone: "info",
    }),
  ];
}

export function buildLotFulfilmentMobileMetrics(summary: AdminLotFulfilmentListSummary) {
  return [
    { id: "queue", label: "Active fulfilment", value: String(summary.total) },
    { id: "pickup", label: "Awaiting pickup", value: String(summary.awaitingPickup) },
    { id: "transit", label: "In transit", value: String(summary.inTransit) },
  ];
}
