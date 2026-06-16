import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { isLotRunCompleted } from "@/lib/saleroom/lot-run-progress";
import { sortLotsForRunList } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot, SaleDeliveryMode } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type SaleroomHubSummary = {
  liveCount: number;
  scheduledCount: number;
  availableCount: number;
};

export type SaleroomHubRowSummary = {
  saleId: string;
  title: string;
  deliveryMode: SaleDeliveryMode;
  saleStatus: string;
  totalLots: number;
  completedLots: number;
  remainingLots: number;
  /** Lot number of current on-block lot when known from SSR snapshot. */
  currentLotNumber: number | null;
  currentLotTitle: string | null;
};

export function mapSaleroomHubRowSummary(row: AdminSaleListRow): SaleroomHubRowSummary {
  const ordered = sortLotsForRunList(row.lots);
  const totalLots = ordered.length;
  const completedLots = ordered.filter((l) => isLotRunCompleted(l.status)).length;
  return {
    saleId: row.sale.id,
    title: row.sale.title ?? "Sale",
    deliveryMode: row.sale.deliveryMode as SaleDeliveryMode,
    saleStatus: row.sale.status,
    totalLots,
    completedLots,
    remainingLots: totalLots - completedLots,
    currentLotNumber: null,
    currentLotTitle: null,
  };
}

export function enrichHubRowWithCurrentLot(
  summary: SaleroomHubRowSummary,
  lots: Lot[],
  currentLotId: string | null,
): SaleroomHubRowSummary {
  if (!currentLotId) return summary;
  const lot = lots.find((l) => l.id === currentLotId);
  if (!lot) return summary;
  return {
    ...summary,
    currentLotNumber: lot.lotNumber,
    currentLotTitle: lot.title,
  };
}

export function filterSaleroomHubRows(rows: readonly AdminSaleListRow[]): AdminSaleListRow[] {
  return rows.filter(
    (row) =>
      isSaleroomDeliveryMode(row.sale.deliveryMode) &&
      (row.sale.status === "active" || row.sale.status === "scheduled"),
  );
}

export function summarizeSaleroomHub(rows: readonly AdminSaleListRow[]): SaleroomHubSummary {
  const liveCount = rows.filter((row) => row.sale.status === "active").length;
  const scheduledCount = rows.filter((row) => row.sale.status === "scheduled").length;
  return {
    liveCount,
    scheduledCount,
    availableCount: rows.length,
  };
}
