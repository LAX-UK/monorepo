import type { Lot } from "@auction/types";

/** Display label for a lot card (catalog number when attached to a sale, else short id). */
export function lotLabelFromLot(lot: Lot): string {
  if (lot.lotNumber != null) {
    return `Lot ${lot.lotNumber}`;
  }
  return `Lot ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Featured hero line, e.g. "Featured lot 134". */
export function featuredLotHeading(lot: Lot): string {
  if (lot.lotNumber != null) {
    return `Featured lot ${lot.lotNumber}`;
  }
  return `Featured lot ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
