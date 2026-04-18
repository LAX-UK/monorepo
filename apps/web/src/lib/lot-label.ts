import type { Lot } from "@auction/types";

/** Display label for a lot card (catalog number when attached to a sale, else short id). */
export function lotLabelFromLot(lot: Lot): string {
  if (lot.lotNumber != null) {
    return `LOT ${lot.lotNumber}`;
  }
  return `LOT ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Featured hero line e.g. FEATURED LOT 134 */
export function featuredLotHeading(lot: Lot): string {
  if (lot.lotNumber != null) {
    return `FEATURED LOT ${lot.lotNumber}`;
  }
  return `FEATURED LOT ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
