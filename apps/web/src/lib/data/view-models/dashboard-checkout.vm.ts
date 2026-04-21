/** Hammer, buyer's premium, and total for checkout display (pure, no I/O). */
export function buildCheckoutTotalsVm(
  currentPrice: string,
  buyerPremiumRate: string,
): {
  hammer: number;
  premium: number;
  total: number;
  buyerPremiumRate: number;
  premiumPercentLabel: string;
} {
  const hammer = Number.parseFloat(currentPrice);
  const rate = Number.parseFloat(buyerPremiumRate);
  const safeHammer = Number.isFinite(hammer) ? hammer : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const premium = safeHammer * safeRate;
  const total = safeHammer + premium;
  return {
    hammer: safeHammer,
    premium,
    total,
    buyerPremiumRate: safeRate,
    premiumPercentLabel: `${Math.round(safeRate * 100)}%`,
  };
}
