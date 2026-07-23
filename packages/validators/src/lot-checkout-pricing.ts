import type { Lot, PublicLotView, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "./buyer-premium.js";

export type LotCheckoutPricing = NonNullable<Lot["checkoutPricing"]>;

/** Hammer + buyer's premium using the same policy factory as payment checkout. */
export function computeLotCheckoutPricing(
  lot: Lot | PublicLotView,
  sale: Sale | null,
): LotCheckoutPricing {
  const policy = buildBuyerPremiumPolicy({
    saleTiers: sale?.buyerPremiumTiers ?? null,
    lotRate: lot.buyerPremiumRate,
  });
  const hammerMajor = lot.currentPrice;
  const premiumMajor = policy.computePremiumMajor(hammerMajor);
  const h = Number.parseFloat(hammerMajor);
  const p = Number.parseFloat(premiumMajor);
  const safeH = Number.isFinite(h) ? h : 0;
  const safeP = Number.isFinite(p) ? p : 0;
  return {
    hammerMajor,
    premiumMajor,
    totalMajor: (safeH + safeP).toFixed(2),
    policyId: policy.id,
    kind: policy.id.startsWith("tiered:") ? ("tiered" as const) : ("flat" as const),
  };
}
