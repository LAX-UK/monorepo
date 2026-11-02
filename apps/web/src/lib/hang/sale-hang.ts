import { pickHangLots } from "@/lib/hang/hang-selection";
import {
  type HangSale,
  type HomeHangWork,
  lotsLabel,
  soldLots,
  toWork,
} from "@/lib/hang/home-hang";
import type { Lot, Sale } from "@auction/types";

export type SaleHangVM = {
  /** "Highlights" before and during the sale; "Top lots" once results are in. */
  title: "Highlights" | "Top lots";
  /** The line before the scale note: "5 featured lots", "All 4 lots sold". */
  summary: string;
  /** A single work hangs beside a quiet figure so its size is felt. */
  figure: boolean;
  works: HomeHangWork[];
};

/** The hang needs a wall: two works with photographs, or one whose real size is known. */
const MIN_WORKS = 2;

type SaleHangInput = {
  sale: Sale;
  /** The sale's lots, withdrawn ones excluded, in any order. */
  lots: readonly Lot[];
  /** Lots in the public catalogue, withdrawn included. */
  lotCount: number;
  /** Sale status as shown to people: ATG-owned drafts read as upcoming, live or ended. */
  status: Sale["status"];
  now: Date;
};

function featuredCount(candidates: readonly Lot[], featuredIds: readonly string[]): number {
  const wanted = new Set(featuredIds);
  return candidates.filter((lot) => wanted.has(lot.id)).length;
}

function highlightsSummary(shown: Lot[], featuredIds: readonly string[], total: number): string {
  if (featuredCount(shown, featuredIds) === shown.length && shown.length >= MIN_WORKS) {
    return `${shown.length} featured lots`;
  }
  return shown.length >= total ? lotsLabel(total) : `${shown.length} of ${lotsLabel(total)}`;
}

function topLotsSummary(sold: number, total: number): string {
  return sold >= total ? `All ${lotsLabel(total)} sold` : `${sold} of ${lotsLabel(total)} sold`;
}

/**
 * The hang that opens a sale's catalogue. Before and during the sale it shows the featured lots
 * (else the top lots by price); once the sale has ended it shows the lots that sold. `null` when
 * there is nothing honest to hang: a cancelled or lotless sale, fewer than two works with
 * photographs, or a single work whose real size is unknown (a figure for scale would mislead).
 */
export function buildSaleHang({
  sale,
  lots,
  lotCount,
  status,
  now,
}: SaleHangInput): SaleHangVM | null {
  if (status === "cancelled" || lotCount === 0) return null;
  const ended = status === "ended";
  const entry: HangSale = { sale, lots: [...lots], lotCount };
  const pool = ended ? soldLots(entry) : entry.lots;
  const featuredIds = sale.featuredLotIds ?? [];
  const picked = pickHangLots(pool, featuredIds);
  const works = picked
    .map((lot) => toWork(lot, sale, now))
    .filter((work): work is HomeHangWork => work !== null);

  if (works.length >= MIN_WORKS) {
    return {
      title: ended ? "Top lots" : "Highlights",
      summary: ended
        ? topLotsSummary(works.length, lotCount)
        : highlightsSummary(picked, featuredIds, Math.max(lotCount, works.length)),
      figure: false,
      works,
    };
  }
  const single = works[0];
  if (works.length === 1 && single && single.photo.longSideCm !== null) {
    return {
      title: ended ? "Top lots" : "Highlights",
      summary: ended ? topLotsSummary(1, lotCount) : lotsLabel(1),
      figure: true,
      works,
    };
  }
  return null;
}
