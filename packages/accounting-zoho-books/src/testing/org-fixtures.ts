import type { ZohoOrgConfigs } from "../adapter/org-config.js";
import { parseOrgConfigs } from "../adapter/org-config.js";

/** Synthetic ids only: none of these exists in any real Books organisation. */
export const SHOP_ORG_ID = "9000000000001";
export const BID_ORG_ID = "9000000000002";
export const DUPLICATE_ZOHO_CODE = 3062;
export const STANDARD_TAX_ID = "9100000000001";
export const ZERO_TAX_ID = "9100000000002";
export const MARGIN_TAX_ID = "9100000000003";

function orgSettings(organizationId: string, base: number) {
  const id = (n: number) => String(base + n);
  return {
    organizationId,
    laxReferenceField: { fieldId: id(1), apiName: "cf_lax_reference" },
    duplicateValueZohoCodes: [DUPLICATE_ZOHO_CODE],
    taxIds: {
      standard: STANDARD_TAX_ID,
      zero: ZERO_TAX_ID,
      exempt: null,
      margin_scheme: MARGIN_TAX_ID,
      outside_scope: null,
    },
    lines: {
      goods: { itemId: id(10), accountId: id(11) },
      delivery: { itemId: id(12), accountId: id(13) },
    },
    payments: { depositAccountId: id(20), paymentMode: "Stripe" },
    bills: { accountId: id(30) },
    templateIds: { invoice: id(40), creditNote: id(41) },
    numberSeriesIds: { invoice: id(50) },
  };
}

/** The raw settings both organisations are read from, as the start-up code would receive them. */
export function rawOrgSettings(): Record<string, unknown> {
  return {
    london_art_exchange: orgSettings(SHOP_ORG_ID, 9200000000000),
    london_auction_xchange: orgSettings(BID_ORG_ID, 9300000000000),
  };
}

export function testOrgConfigs(): ZohoOrgConfigs {
  return parseOrgConfigs(rawOrgSettings());
}

/** The tax rates (basis points) the simulated Books applies to each configured tax id. */
export const TEST_TAX_RATES_BPS: Readonly<Record<string, number>> = {
  [STANDARD_TAX_ID]: 2000,
  [ZERO_TAX_ID]: 0,
  [MARGIN_TAX_ID]: 0,
};
