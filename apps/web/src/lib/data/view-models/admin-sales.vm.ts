import type { AdminSaleBoardRow } from "@/lib/admin/catalog/sale-table-row";
import type { SaleDeleteEligibility } from "@/lib/data/http/admin.server";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import { formatDateTime } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";
import { toDisplayDate, toRequiredIsoString } from "@auction/validators";

function saleCoverImageUrl(sale: Sale): string | null {
  const asset = sale.coverImageAssets?.[0];
  if (asset?.src) return asset.src;
  return sale.coverImages[0] ?? null;
}

export type AdminSaleBoardInput = {
  sale: Sale;
  lots: Lot[];
  deleteEligibility?: SaleDeleteEligibility | null;
};

/** Count lots whose calendar end day falls in the next `days` days from local midnight (normalized 0–1). */
export function scheduleEndingSparkline(lots: Lot[], days = 7): number[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, () => 0);
  for (const lot of lots) {
    const e = toDisplayDate(lot.endTime);
    e.setHours(0, 0, 0, 0);
    const diff = Math.round((e.getTime() - now.getTime()) / 86400000);
    if (diff >= 0 && diff < days) {
      const i = diff;
      buckets[i] = (buckets[i] ?? 0) + 1;
    }
  }
  const max = Math.max(...buckets, 1);
  return buckets.map((b) => b / max);
}

export function toAdminSaleBoardRow(row: AdminSaleBoardInput): AdminSaleBoardRow {
  const endTime = row.sale.endTime;
  return {
    saleId: row.sale.id,
    title: row.sale.title,
    status: row.sale.status,
    lotCount: row.lots.length,
    coverImageUrl: saleCoverImageUrl(row.sale),
    deliveryMode: row.sale.deliveryMode,
    typeLabel: deliveryModeShortLabel(row.sale.deliveryMode),
    startTimeIso: toRequiredIsoString(row.sale.startTime),
    startTimeLabel: formatDateTime(row.sale.startTime),
    endTimeIso: endTime ? toRequiredIsoString(endTime) : null,
    endTimeLabel: endTime ? formatDateTime(endTime) : "—",
    sparklineValues: scheduleEndingSparkline(row.lots, 7),
    canDelete: row.deleteEligibility?.canDelete === true,
  };
}
