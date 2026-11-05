/**
 * The version of each company's Terms and Privacy notice that is currently published. A person
 * who creates a LAX Account is recorded as accepting these, so change a version here in the same
 * change as the wording it names. Kept in the Identity contract because Identity writes the record
 * and cannot depend on the products' packages.
 */

/** The companies behind the LAX products; the same ids @auction/branding names them by. */
export type LegalEntityId = "london-auction-xchange" | "london-art-exchange";

/** The LAX products whose Terms and Privacy notice a person can be shown at sign-up. */
export type LegalDocumentProduct = "account" | "bid" | "shop" | "art";

/** Registered names, as @auction/branding files them (checked in apps/web). */
export const LEGAL_ENTITY_NAMES: Readonly<Record<LegalEntityId, string>> = {
  "london-auction-xchange": "London Auction Xchange LTD",
  "london-art-exchange": "London Art Exchange Ltd",
};

/** How each product is written, as @auction/branding writes it (checked in apps/web). */
export const LEGAL_DOCUMENT_PRODUCT_NAMES: Readonly<Record<LegalDocumentProduct, string>> = {
  account: "LAX Account",
  bid: "LAX Bid",
  shop: "LAX Shop",
  art: "lax.art",
};

export type LegalDocumentKind = "terms" | "privacy";

export type LegalDocumentVersion = {
  /** The identifier the company publishes the document under. */
  readonly version: string;
  /** ISO date (YYYY-MM-DD) from which this wording applies. */
  readonly effectiveOn: string;
};

export type LegalDocumentSet = {
  readonly entity: LegalEntityId;
  readonly terms: LegalDocumentVersion;
  readonly privacy: LegalDocumentVersion;
};

export const LEGAL_DOCUMENT_SETS: Readonly<Record<LegalEntityId, LegalDocumentSet>> = {
  // lax.bid publishes the Conditions of business and the privacy notice, each dated by its last update.
  "london-auction-xchange": {
    entity: "london-auction-xchange",
    terms: { version: "2026-06-17", effectiveOn: "2026-06-17" },
    privacy: { version: "2026-04-21", effectiveOn: "2026-04-21" },
  },
  // LAX Shop and lax.art publish one numbered release of the London Art Exchange policies.
  "london-art-exchange": {
    entity: "london-art-exchange",
    terms: { version: "1.0", effectiveOn: "2026-08-12" },
    privacy: { version: "1.0", effectiveOn: "2026-08-12" },
  },
};

/**
 * The documents a person is shown when they create an account through a product: the product's
 * own company's, except LAX Account, which links the ones LAX Bid publishes (as the hosted
 * sign-up page does).
 */
const DOCUMENT_ENTITY_BY_PRODUCT: Readonly<Record<LegalDocumentProduct, LegalEntityId>> = {
  bid: "london-auction-xchange",
  account: "london-auction-xchange",
  shop: "london-art-exchange",
  art: "london-art-exchange",
};

export function acceptedLegalDocumentsFor(product: LegalDocumentProduct): LegalDocumentSet {
  return LEGAL_DOCUMENT_SETS[DOCUMENT_ENTITY_BY_PRODUCT[product]];
}

const POLICY_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "17 June 2026", for the "Last updated" line of a policy page. */
export function formatLegalDocumentDate(isoDate: string): string {
  return POLICY_DATE.format(new Date(`${isoDate}T00:00:00Z`));
}
