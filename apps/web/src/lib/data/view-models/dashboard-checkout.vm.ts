import type { Lot } from "@auction/types";

/** Hammer, buyer's premium, and total for checkout display (pure, no I/O). Requires BE `checkoutPricing`. */
export function buildCheckoutTotalsVm(checkoutPricing: NonNullable<Lot["checkoutPricing"]>): {
  hammer: number;
  premium: number;
  total: number;
  buyerPremiumRate: number;
  premiumPercentLabel: string;
} {
  const hammer = Number.parseFloat(checkoutPricing.hammerMajor);
  const premium = Number.parseFloat(checkoutPricing.premiumMajor);
  const total = Number.parseFloat(checkoutPricing.totalMajor);
  const safeHammer = Number.isFinite(hammer) ? hammer : 0;
  const safePremium = Number.isFinite(premium) ? premium : 0;
  const safeTotal = Number.isFinite(total) ? total : safeHammer + safePremium;
  const effectiveRate = safeHammer > 0 ? safePremium / safeHammer : 0;
  return {
    hammer: safeHammer,
    premium: safePremium,
    total: safeTotal,
    buyerPremiumRate: effectiveRate,
    premiumPercentLabel:
      checkoutPricing.kind === "tiered"
        ? "Tiered"
        : `${Math.min(100, Math.max(0, Math.round(effectiveRate * 100)))}%`,
  };
}
