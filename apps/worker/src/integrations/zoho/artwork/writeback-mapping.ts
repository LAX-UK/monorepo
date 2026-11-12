import { type OfferState, zohoStatusForOffer } from "@auction/artwork-register-contracts";

/** The Zoho Products field LAX writes the artwork's place into. Its values are a Zoho picklist. */
export const ZOHO_STATUS_FIELD = "Status";
/** The Zoho Products field LAX writes the stock code into. */
export const ZOHO_STOCK_CODE_FIELD = "Reference_Stock_Code";

export { zohoStatusForOffer };

/** What Zoho holds for a Product now, as far as the writeback cares. */
export type ZohoProductState = {
  status: string | null;
  stockCode: string | null;
};

/** The fields to send, or none when Zoho already holds the value. */
export type ZohoProductUpdate = {
  fields: Record<string, string>;
};

/** Sends the Status only when it differs; Zoho owns the rest of the Product. */
export function planStatusUpdate(
  offerState: OfferState,
  current: ZohoProductState,
): ZohoProductUpdate | null {
  const wanted = zohoStatusForOffer(offerState);
  return current.status === wanted ? null : { fields: { [ZOHO_STATUS_FIELD]: wanted } };
}

/** Sends the stock code only when it differs. */
export function planStockCodeUpdate(
  stockCode: string,
  current: ZohoProductState,
): ZohoProductUpdate | null {
  return current.stockCode === stockCode
    ? null
    : { fields: { [ZOHO_STOCK_CODE_FIELD]: stockCode } };
}
