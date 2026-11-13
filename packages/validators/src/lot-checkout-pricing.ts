import type { Lot, PublicLotView, Sale } from "@auction/types";
import { minorToMajor, resolveBuyerPremium } from "./buyer-premium.js";
import { majorToPence } from "./major-to-pence.js";

export type LotCheckoutPricing = NonNullable<Lot["checkoutPricing"]>;

/**
 * Hammer + buyer's premium through the same resolver as the invoice, with the premium that
 * applies and where it came from, so every surface can say it in the same words.
 */
export function computeLotCheckoutPricing(
  lot: Lot | PublicLotView,
  sale: Sale | null,
): LotCheckoutPricing {
  const { policy, schedule, source } = resolveBuyerPremium({
    lotRate: lot.buyerPremiumRate,
    sale,
  });
  const hammerMajor = lot.currentPrice;
  const hammerPence = majorToPence(hammerMajor);
  const premiumPence = policy.computePremiumMinor(hammerPence);
  const totalPence = hammerPence + premiumPence;
  return {
    hammerMajor,
    premiumMajor: minorToMajor(premiumPence),
    totalMajor: minorToMajor(totalPence),
    policyId: policy.id,
    kind: schedule.kind === "bands" ? ("tiered" as const) : ("flat" as const),
    premium: { source, schedule, breakdown: policy.breakdown(hammerPence) },
  };
}
