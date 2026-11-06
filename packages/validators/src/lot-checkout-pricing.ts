import type { Lot, PublicLotView, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "./buyer-premium.js";
import { majorToPence } from "./major-to-pence.js";

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
  const totalPence = majorToPence(hammerMajor) + majorToPence(premiumMajor);
  return {
    hammerMajor,
    premiumMajor,
    totalMajor: (totalPence / 100).toFixed(2),
    policyId: policy.id,
    kind: policy.id.startsWith("tiered:") ? ("tiered" as const) : ("flat" as const),
  };
}
