import type { Lot } from "@auction/types";

/** Derive minor-unit price for view_item from current bid or estimate low. */
export function lotViewItemPriceMinor(
  lot: Pick<Lot, "currentPrice" | "marketingDetails">,
): number | undefined {
  const current = Number.parseFloat(lot.currentPrice);
  if (Number.isFinite(current) && current > 0) {
    return Math.round(current * 100);
  }
  const low = lot.marketingDetails?.estimate?.low;
  if (low) {
    const est = Number.parseFloat(low);
    if (Number.isFinite(est) && est > 0) return Math.round(est * 100);
  }
  return undefined;
}
