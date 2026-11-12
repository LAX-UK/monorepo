import type { WhereItIsKey } from "@auction/artwork-register-contracts";
import { ZOHO_STATUS } from "./status/decide-status-write.js";

/** The Zoho Products field LAX writes the artwork's place into. Its values are a Zoho picklist. */
export const ZOHO_STATUS_FIELD = "Status";
/** The Zoho Products field LAX writes the stock code into. */
export const ZOHO_STOCK_CODE_FIELD = "Reference_Stock_Code";

/**
 * Where each place an artwork is shown reads in the Zoho Products Status picklist. It maps the
 * "Where it is" place, not the raw register state, so a withdrawn artwork reads Withdrawn only for
 * the 30 days that place shows it and is Available again after that.
 */
const STATUS_FOR_PLACE: Readonly<Record<WhereItIsKey, string>> = {
  not_offered: ZOHO_STATUS.available,
  draft_lax_art: ZOHO_STATUS.available,
  lax_art: ZOHO_STATUS.available,
  draft_bid_lot: ZOHO_STATUS.available,
  bid_sale: ZOHO_STATUS.inAuction,
  private_sale: ZOHO_STATUS.reserved,
  withdrawn: ZOHO_STATUS.withdrawn,
  sold: ZOHO_STATUS.sold,
};

export function zohoStatusForPlace(place: WhereItIsKey): string {
  return STATUS_FOR_PLACE[place];
}

/** What Zoho holds for a Product now, as far as the stock code writeback cares. */
export type ZohoProductState = {
  stockCode: string | null;
};

/** The fields to send, or none when Zoho already holds the value. */
export type ZohoProductUpdate = {
  fields: Record<string, string>;
};

/** Sends the stock code only when it differs. */
export function planStockCodeUpdate(
  stockCode: string,
  current: ZohoProductState,
): ZohoProductUpdate | null {
  return current.stockCode === stockCode
    ? null
    : { fields: { [ZOHO_STOCK_CODE_FIELD]: stockCode } };
}
