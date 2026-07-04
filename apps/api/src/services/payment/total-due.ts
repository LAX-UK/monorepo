import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { buildBuyerPremiumPolicy } from "@auction/validators";
import { gbpAmountToPence } from "../../lib/decimal-money.js";

/**
 * Hammer + buyer's premium, in pence.
 *
 * Pricing rule (Strategy + Dependency Inversion):
 *  1. Resolve the parent sale (if a `ISaleRepository` is wired and `lot.saleId` is set).
 *  2. Delegate to `buildBuyerPremiumPolicy({ saleTiers, lotRate })` — a sale with non-empty
 *     `buyerPremiumTiers` overrides the per-lot flat rate; otherwise the existing per-lot
 *     `buyerPremiumRate` is used (back-compat).
 *  3. Add the premium to hammer.
 */
export async function computeTotalDuePence(
  sales: ISaleRepository | null,
  lot: Lot,
): Promise<number> {
  const hammerPence = gbpAmountToPence(lot.currentPrice);
  let sale: Sale | null = null;
  if (sales && lot.saleId) {
    sale = await sales.findById(lot.saleId).catch(() => null);
  }
  const policy = buildBuyerPremiumPolicy({
    saleTiers: sale?.buyerPremiumTiers ?? null,
    lotRate: lot.buyerPremiumRate,
  });
  const premiumPence = gbpAmountToPence(policy.computePremiumMajor(lot.currentPrice));
  return hammerPence + premiumPence;
}
