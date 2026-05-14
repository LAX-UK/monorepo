import type { Lot, PortfolioRow } from "@auction/types";

/** Total payable (hammer + buyer's premium) in major currency units from BE `checkoutPricing` only. */
export function lotTotalMajorUnits(lot: Lot): number {
  const cp = lot.checkoutPricing;
  if (!cp) return 0;
  const t = Number.parseFloat(cp.totalMajor);
  return Number.isFinite(t) ? t : 0;
}

export function portfolioRowTotalMajorUnits(row: PortfolioRow): number {
  return lotTotalMajorUnits(row.lot);
}
