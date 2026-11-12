import type { ISellerTermsPolicy, SellerTermsHeldReason } from "@auction/domain";
import { hammerAndPremiumOf } from "@auction/finance-runtime";
import { ReofferError } from "./reoffer-errors.js";
import type { IReofferPricing, IReofferSellerProceeds } from "./reoffer-ports.js";

/** What staff do about each reason a seller's figure cannot be worked out. */
const HELD_MESSAGES: Record<SellerTermsHeldReason, string> = {
  no_agreement:
    "This lot has no signed consignment agreement on record, so what the seller would receive cannot be worked out.",
  not_accepted: "The seller has not accepted the consignment agreement for this lot yet.",
  no_commission:
    "The consignment agreement for this lot has no commission, so what the seller would receive cannot be worked out.",
  other_seller: "The consignment agreement for this lot belongs to a different seller.",
  vat_setting_missing:
    "The company's VAT setting for commission is missing, so what the seller would receive cannot be worked out.",
  negative_net: "The agreed commission and VAT on it are more than this hammer.",
};

/**
 * The seller's proceeds at a hammer, by the rule settlement pays by: the lot priced for the buyer
 * the way their invoice would be, then the signed agreement's commission on the hammer plus VAT.
 * The figure the seller agrees to is the figure Sold & payouts later shows. LAX-owned stock pays
 * nothing out. A lot whose terms cannot be worked out refuses, rather than showing a guessed figure.
 */
export function settlementSellerProceeds(deps: {
  pricing: IReofferPricing;
  terms: ISellerTermsPolicy;
}): IReofferSellerProceeds {
  return {
    async proceedsFor({ lotId, sellerLegalEntityId, buyerLegalEntityId, hammerPence }) {
      const priced = await deps.pricing.priceFor({ lotId, buyerLegalEntityId, hammerPence });
      const { premiumPence } = hammerAndPremiumOf(priced.lines);
      const terms = await deps.terms.snapshotFor({
        lotId,
        sellerLegalEntityId,
        hammerPence,
        premiumPence,
      });
      switch (terms.basis) {
        case "agreement":
          return { salePence: priced.totalPence, proceedsPence: terms.sellerNetPence };
        case "lax_owned":
          return { salePence: priced.totalPence, proceedsPence: 0 };
        case "held":
          throw new ReofferError("seller_terms_unavailable", HELD_MESSAGES[terms.heldReason]);
      }
    },
  };
}
