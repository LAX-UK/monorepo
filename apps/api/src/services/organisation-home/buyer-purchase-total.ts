import { addMoneyStrings } from "@auction/domain";
import { buildBuyerPremiumPolicy } from "@auction/validators";
import type { PurchaseTotal } from "./organisation-dashboard.service.js";

/**
 * What a won lot costs: hammer plus the buyer's premium from the same policy checkout uses (a
 * sale's tiers when it has them, else the lot's rate), so Home and checkout never disagree.
 */
export const buyerPurchaseTotal: PurchaseTotal = (purchase) => {
  const policy = buildBuyerPremiumPolicy({
    saleTiers: purchase.saleTiers,
    lotRate: purchase.lotPremiumRate,
  });
  return addMoneyStrings(purchase.hammer, policy.computePremiumMajor(purchase.hammer));
};
