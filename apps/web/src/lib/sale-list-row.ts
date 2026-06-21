import { parseLot, parseSale } from "@/lib/data/http/parse";
import type { Lot, Sale } from "@auction/types";

/** Public catalogue sales list row: sale metadata + preview lots + total lot count. */
export type SaleListRow = { sale: Sale; lots: Lot[]; lotCount: number };

/** Resolve API lotCount with safe fallback to preview array length. */
export function resolveSaleLotCount(lotCount: unknown, previewLength: number): number {
  if (lotCount == null) return previewLength;
  const n = Number(lotCount);
  return Number.isFinite(n) && n >= 0 ? n : previewLength;
}

/** Card / grid copy: "1 Item" | "15 Items". */
export function formatSaleItemsLabel(count: number): string {
  return `${count} Item${count === 1 ? "" : "s"}`;
}

/** Agenda / related rail copy: "1 lot" | "10 lots". */
export function formatSaleLotsLabel(count: number): string {
  return `${count} lot${count === 1 ? "" : "s"}`;
}

/** Parse one row from `GET /sales` list payload. */
export function parseSaleListRowApiPayload(row: unknown): SaleListRow {
  const o = row as { sale: unknown; lots?: unknown[]; lotCount?: unknown };
  const lots = (o.lots ?? []).map(parseLot);
  return {
    sale: parseSale(o.sale),
    lots,
    lotCount: resolveSaleLotCount(o.lotCount, lots.length),
  };
}

/** Test / legacy helper when only sale + preview lots are available. */
export function saleListRow(sale: Sale, lots: Lot[], lotCount?: number): SaleListRow {
  return { sale, lots, lotCount: lotCount ?? lots.length };
}
