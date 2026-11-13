import type { ZohoOrgConfigs } from "../adapter/org-config.js";
import { parseOrgConfigs } from "../adapter/org-config.js";

/** Synthetic ids only: none of these exists in any real Books organisation. */
export const SHOP_ORG_ID = "9000000000001";
export const BID_ORG_ID = "9000000000002";
export const DUPLICATE_ZOHO_CODE = 3062;

/**
 * Tax ids of the test Bid organisation. Each organisation has its own, so a mapper that read the
 * wrong organisation's tax settings would send an id the receiving organisation does not hold.
 */
export const BID_TAX_IDS = {
  standard: "9120000000001",
  zero: "9120000000002",
  margin_scheme: "9120000000003",
} as const;
/** Only used by tests that model a hypothetical VAT-registered Shop organisation. */
export const SHOP_TAX_IDS = {
  standard: "9110000000001",
  zero: "9110000000002",
  margin_scheme: "9110000000003",
} as const;

function orgSettings(
  organizationId: string,
  base: number,
  tax: { readonly standard: string; readonly zero: string; readonly margin_scheme: string } | null,
) {
  const id = (n: number) => String(base + n);
  return {
    organizationId,
    environment: "test",
    laxReferenceField: { fieldId: id(1), apiName: "cf_lax_reference" },
    duplicateValueZohoCodes: [DUPLICATE_ZOHO_CODE],
    vatRegistered: tax !== null,
    ...(tax
      ? {
          taxIds: {
            standard: tax.standard,
            zero: tax.zero,
            exempt: null,
            margin_scheme: tax.margin_scheme,
            outside_scope: null,
          },
        }
      : {}),
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

export interface OrgFixtureOptions {
  /** Leave the Bid organisation out, as it is until it exists. Default false. */
  readonly withoutBid?: boolean;
  /**
   * Model the Shop organisation as VAT registered. Default false: London Art Exchange is not VAT
   * registered in Books today, and the fixture says so.
   */
  readonly shopVatRegistered?: boolean;
}

/**
 * The raw settings the organisations are read from, as the start-up code would receive them.
 *
 * London Art Exchange (Shop, lax.art) is NOT VAT registered, matching the live Books organisation.
 * The Bid organisation does not exist yet and its VAT status is an open question for the owners
 * and accountant: this fixture models it as registered only so the VAT paths have an organisation
 * to run against. It is not a statement about the real company.
 */
export function rawOrgSettings(options: OrgFixtureOptions = {}): Record<string, unknown> {
  return {
    london_art_exchange: orgSettings(
      SHOP_ORG_ID,
      9200000000000,
      options.shopVatRegistered ? SHOP_TAX_IDS : null,
    ),
    ...(options.withoutBid
      ? {}
      : { london_auction_xchange: orgSettings(BID_ORG_ID, 9300000000000, BID_TAX_IDS) }),
  };
}

export function testOrgConfigs(options: OrgFixtureOptions = {}): ZohoOrgConfigs {
  return parseOrgConfigs(rawOrgSettings(options));
}

/** The tax rates (basis points) the simulated Books applies to each tax id it holds. */
export const TEST_TAX_RATES_BPS: Readonly<Record<string, number>> = {
  [BID_TAX_IDS.standard]: 2000,
  [BID_TAX_IDS.zero]: 0,
  [BID_TAX_IDS.margin_scheme]: 0,
  [SHOP_TAX_IDS.standard]: 2000,
  [SHOP_TAX_IDS.zero]: 0,
  [SHOP_TAX_IDS.margin_scheme]: 0,
};
