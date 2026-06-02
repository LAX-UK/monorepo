import type { Lot } from "@auction/types";

export type SaleLotsSort = "lot" | "priceAsc" | "priceDesc" | "endingAsc";

/** Stable sort for saleroom catalog pagination (pure, testable). */
export function sortSaleLots(lots: Lot[], sort: SaleLotsSort = "lot"): Lot[] {
  const sorted = [...lots];
  const parse = (p: string) => Number.parseFloat(p) || 0;
  switch (sort) {
    case "priceAsc":
      sorted.sort((a, b) => parse(a.currentPrice) - parse(b.currentPrice));
      break;
    case "priceDesc":
      sorted.sort((a, b) => parse(b.currentPrice) - parse(a.currentPrice));
      break;
    case "endingAsc":
      sorted.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
      break;
    default:
      sorted.sort((a, b) => (a.lotNumber ?? 999_999) - (b.lotNumber ?? 999_999));
  }
  return sorted;
}
