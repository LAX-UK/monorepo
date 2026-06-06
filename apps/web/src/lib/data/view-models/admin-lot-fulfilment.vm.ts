import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin.server";

export type LotFulfilmentKpiSummary = {
  total: number;
  awaitingPickup: number;
  inTransit: number;
};

export function summarizeLotFulfilmentKpis(
  total: number,
  statusCounts: Record<string, number>,
): LotFulfilmentKpiSummary {
  const awaitingPickup =
    (statusCounts.ready_for_collection ?? 0) + (statusCounts.awaiting_release ?? 0);
  const inTransit = (statusCounts.in_transit ?? 0) + (statusCounts.released ?? 0);
  return { total, awaitingPickup, inTransit };
}

export type LotFulfilmentTableRow = AdminLotFulfilmentListRow;

export function buildLotFulfilmentTableRows(
  rows: AdminLotFulfilmentListRow[],
): LotFulfilmentTableRow[] {
  return rows;
}
