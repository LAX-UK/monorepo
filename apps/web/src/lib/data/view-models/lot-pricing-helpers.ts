import type { Lot, PortfolioRow } from "@auction/types";

/** Total payable (hammer + buyer's premium) in major currency units, using BE pricing when present. */
export function lotTotalMajorUnits(lot: Lot): number {
  const cp = lot.checkoutPricing;
  if (cp) {
    const t = Number.parseFloat(cp.totalMajor);
    return Number.isFinite(t) ? t : 0;
  }
  const hammer = Number.parseFloat(lot.currentPrice);
  const rate = Number.parseFloat(lot.buyerPremiumRate);
  const safeHammer = Number.isFinite(hammer) ? hammer : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  return safeHammer * (1 + safeRate);
}

export function portfolioRowTotalMajorUnits(row: PortfolioRow): number {
  return lotTotalMajorUnits(row.lot);
}
