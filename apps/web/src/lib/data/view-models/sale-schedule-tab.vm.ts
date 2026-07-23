import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import type { Lot, Sale } from "@auction/types";

function scheduleRelativeLabel(sale: Sale): string {
  const now = new Date();
  if (sale.status === "active" && sale.endTime.getTime() > now.getTime()) {
    return formatAdminTableDateTime(sale.endTime, "deadline", { now }).primary;
  }
  if (sale.status === "scheduled" && sale.startTime.getTime() > now.getTime()) {
    return formatAdminTableDateTime(sale.startTime, "deadline", {
      now,
      deadlineKind: "start",
    }).primary;
  }
  if (sale.status === "ended") return "Completed";
  if (sale.status === "cancelled") return "Cancelled";
  return "—";
}

export function buildSaleScheduleKpiTiles(sale: Sale, lots: readonly Lot[]): DetailBoardKpiTile[] {
  return [
    {
      id: "window",
      label: "Sale window",
      value: scheduleRelativeLabel(sale),
      compareHint: `${formatAdminTableDateTime(sale.startTime, "timestamp").primary} → ${formatAdminTableDateTime(sale.endTime, "timestamp").primary}`,
    },
    {
      id: "lots",
      label: "Lots scheduled",
      value: String(lots.length),
      compareHint: lots.length > 0 ? "Per-lot timing below" : "None attached yet",
    },
    {
      id: "preview",
      label: "Preview opens",
      value: sale.previewStartTime
        ? formatAdminTableDateTime(sale.previewStartTime, "timestamp").primary
        : "—",
      compareHint: sale.previewStartTime ? "Before sale start" : "Not configured",
    },
  ];
}
