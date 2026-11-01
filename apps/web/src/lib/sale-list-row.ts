import { parseLot, parseSale } from "@/lib/data/http/parse";
import type { SaleResultsSummary } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";

/** Public catalogue sales list row: sale metadata + preview lots + total lot count. */
export type SaleListRow = {
  sale: Sale;
  lots: Lot[];
  lotCount: number;
  /** Results of an ended sale: finalising, or final with figures. Absent before the sale ends. */
  resultsSummary?: SaleResultsSummary | null;
};

/** Resolve API lotCount with safe fallback to preview array length. */
export function resolveSaleLotCount(lotCount: unknown, previewLength: number): number {
  if (lotCount == null) return previewLength;
  const n = Number(lotCount);
  return Number.isFinite(n) && n >= 0 ? n : previewLength;
}

/** Card / grid copy: "1 item" | "15 items". */
export function formatSaleItemsLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

/** Agenda / related rail copy: "1 lot" | "10 lots". */
export function formatSaleLotsLabel(count: number): string {
  return `${count} lot${count === 1 ? "" : "s"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Read the API's `resultsSummary`; anything that is not a known shape is treated as absent. */
export function parseResultsSummary(raw: unknown): SaleResultsSummary | null {
  if (!isRecord(raw)) return null;
  if (raw.state === "finalising") {
    return { state: "finalising", pendingLotCount: Number(raw.pendingLotCount ?? 0) };
  }
  if (raw.state !== "final") return null;
  const top = isRecord(raw.topLot) ? raw.topLot : null;
  return {
    state: "final",
    lotCount: Number(raw.lotCount ?? 0),
    soldCount: Number(raw.soldCount ?? 0),
    currency: typeof raw.currency === "string" ? raw.currency : "GBP",
    totalWithPremium: String(raw.totalWithPremium ?? "0"),
    topLot: top
      ? { lotId: String(top.lotId ?? ""), priceWithPremium: String(top.priceWithPremium ?? "0") }
      : null,
    endedAt: String(raw.endedAt ?? ""),
  };
}

/** Parse one row from `GET /sales` list payload. */
export function parseSaleListRowApiPayload(row: unknown): SaleListRow {
  const o = row as {
    sale: unknown;
    lots?: unknown[];
    lotCount?: unknown;
    resultsSummary?: unknown;
  };
  const lots = (o.lots ?? []).map(parseLot);
  return {
    sale: parseSale(o.sale),
    lots,
    lotCount: resolveSaleLotCount(o.lotCount, lots.length),
    resultsSummary: parseResultsSummary(o.resultsSummary),
  };
}

/** Test / legacy helper when only sale + preview lots are available. */
export function saleListRow(sale: Sale, lots: Lot[], lotCount?: number): SaleListRow {
  return { sale, lots, lotCount: lotCount ?? lots.length };
}
