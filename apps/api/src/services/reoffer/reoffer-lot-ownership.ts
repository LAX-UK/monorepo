import type { ISellerTermsFacts } from "@auction/domain";
import type { IReofferLotOwnership } from "./reoffer-ports.js";

/**
 * Whether a lot is LAX's own stock is a fact about the seller account (its subkind), not a list
 * kept in configuration: offering such a lot to an underbidder needs no seller answer, and every
 * other lot asks the seller.
 */
export function lotOwnershipFromAccount(
  facts: Pick<ISellerTermsFacts, "isLaxOwned">,
): IReofferLotOwnership {
  return {
    async of(sellerLegalEntityId) {
      if (sellerLegalEntityId === null) return "seller";
      return (await facts.isLaxOwned(sellerLegalEntityId)) ? "lax_owned" : "seller";
    },
  };
}
