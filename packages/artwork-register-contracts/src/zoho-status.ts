import type { OfferState } from "./offer-state.js";

/**
 * Where each LAX place shows in the Zoho Products Status picklist. LAX writes it to Zoho and the
 * sync health report compares it with what Zoho holds, so both read this one table.
 */
export const ZOHO_STATUS_FOR_OFFER: Readonly<Record<OfferState, string>> = {
  held: "Available",
  lax_art: "Available",
  bid_sale: "In Auction",
  private_sale: "Reserved",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

export function zohoStatusForOffer(state: OfferState): string {
  return ZOHO_STATUS_FOR_OFFER[state];
}

/**
 * Zoho OAuth token refreshes that fail in a row before the connection counts as failing: the
 * worker logs its alert on this one and LAX Admin's Sync health tab shows its notice.
 */
export const ZOHO_TOKEN_FAILING_STREAK = 2;
