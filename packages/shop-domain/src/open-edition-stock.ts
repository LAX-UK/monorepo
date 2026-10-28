import type { EditionCustodyStatus } from "./edition-custody-state.js";
import type { EditionListingStatus } from "./edition-listing-state.js";

/** Staff are warned, and Overview lists the run, while this many prints or fewer are on sale. */
export const OPEN_EDITION_LOW_STOCK_AT = 3 as const;

export type OpenStockCounts = {
  onSale: number;
  reserved: number;
  sold: number;
  /** Not printed yet: printed to order when sold. */
  toPrint: number;
  /** Printed and in LAX storage, not yet sold. */
  inStorage: number;
};

/**
 * Staff-only counts for an open edition's stock. Shoppers never see them: an open edition shows
 * only whether a print can be bought.
 */
export function summariseOpenStock(
  prints: ReadonlyArray<{
    listingStatus: EditionListingStatus;
    custodyStatus: EditionCustodyStatus;
  }>,
): OpenStockCounts {
  const counts: OpenStockCounts = { onSale: 0, reserved: 0, sold: 0, toPrint: 0, inStorage: 0 };
  for (const print of prints) {
    if (print.listingStatus === "authorised") counts.onSale += 1;
    if (print.listingStatus === "reserved" || print.listingStatus === "held") counts.reserved += 1;
    if (print.listingStatus === "sold") {
      counts.sold += 1;
      continue;
    }
    if (print.listingStatus === "withdrawn") continue;
    if (print.custodyStatus === "unprinted") counts.toPrint += 1;
    if (print.custodyStatus === "stored") counts.inStorage += 1;
  }
  return counts;
}

export function isOpenStockLow(counts: Pick<OpenStockCounts, "onSale">): boolean {
  return counts.onSale <= OPEN_EDITION_LOW_STOCK_AT;
}
