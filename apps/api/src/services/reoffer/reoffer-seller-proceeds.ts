import { type IPlatformFeePolicy, sellerNetForSale } from "@auction/finance-runtime";
import type { IReofferPricing, IReofferSellerProceeds } from "./reoffer-ports.js";

/**
 * The seller's proceeds at a hammer, as settlement would pay them: the lot priced for the buyer
 * the way their invoice would be (hammer and buyer's premium), less the seller account's platform
 * fee on that total. The figure the seller agrees to is the figure Sold & payouts later shows.
 */
export function settlementSellerProceeds(deps: {
  pricing: IReofferPricing;
  feePolicy: Pick<IPlatformFeePolicy, "computePlatformFeeFromPence">;
}): IReofferSellerProceeds {
  return {
    async proceedsFor({ lotId, sellerLegalEntityId, buyerLegalEntityId, hammerPence }) {
      const priced = await deps.pricing.priceFor({ lotId, buyerLegalEntityId, hammerPence });
      const net = await sellerNetForSale(deps.feePolicy, sellerLegalEntityId, priced.totalPence);
      return { salePence: net.salePence, proceedsPence: net.netPence };
    },
  };
}
