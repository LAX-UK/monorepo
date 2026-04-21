import type { Lot, Sale } from "@auction/types";

export type AdminSaleBoardInput = {
  sale: Sale;
  lots: Lot[];
};

/** Count lots whose calendar end day falls in the next `days` days from local midnight (normalized 0–1). */
export function scheduleEndingSparkline(lots: Lot[], days = 7): number[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, () => 0);
  for (const lot of lots) {
    const e = new Date(lot.endTime);
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

export function toAdminSaleBoardRow(row: AdminSaleBoardInput) {
  return {
    saleId: row.sale.id,
    title: row.sale.title,
    status: row.sale.status,
    lotCount: row.lots.length,
    sparklineValues: scheduleEndingSparkline(row.lots, 7),
  };
}
