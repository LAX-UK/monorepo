import { majorGbpToPence } from "@auction/domain";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "./buyer-premium.js";

export type LotCheckoutPricing = NonNullable<Lot["checkoutPricing"]>;

/** A money string in pounds ("1250.5", "1250.50") as whole pence, through the shared rule. */
function majorToPence(major: string): number {
  const n = Number.parseFloat(major);
  return Number.isFinite(n) ? majorGbpToPence(n) : 0;
}

/**
 * Hammer + buyer's premium in whole pence: the one calculator for an invoice total, used when
 * the invoice is raised (at lot end or at checkout) and for what pages show. Each part is
 * rounded to the penny first, then added, so the total always equals the sum of its lines.
 */
export function lotTotalDuePence(lot: Lot | PublicLotView, sale: Sale | null): number {
  const pricing = computeLotCheckoutPricing(lot, sale);
  return majorToPence(pricing.hammerMajor) + majorToPence(pricing.premiumMajor);
}

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
