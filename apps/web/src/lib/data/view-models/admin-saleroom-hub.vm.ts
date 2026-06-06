import type { AdminSaleListRow } from "@/lib/data/http/admin.server";

export type SaleroomHubSummary = {
  liveCount: number;
  scheduledCount: number;
  availableCount: number;
};

export function filterSaleroomHubRows(rows: readonly AdminSaleListRow[]): AdminSaleListRow[] {
  return rows.filter(
    (row) =>
      row.sale.deliveryMode === "onsite" &&
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
