import type { LaxBrandProduct } from "./brand-identity.js";
import type { PostalAddressInput } from "./structured-data.js";

/**
 * The companies behind the LAX products. Each product names its own operator in footers,
 * policies, structured data, emails and receipts; LAX Account is provided by both.
 * Read names and details from here, never from a string in an app.
 */

export type LegalEntityId = "london-auction-xchange" | "london-art-exchange";

export type RegisteredAddress = {
  /** Postal lines, without the company name. */
  readonly lines: readonly string[];
  /** One line for footers: "156 New Cavendish Street, Marylebone, London W1W 6YW, United Kingdom". */
  readonly inline: string;
  readonly postal: PostalAddressInput;
};

export type LegalEntity = {
  readonly id: LegalEntityId;
  /** Registered company name, exactly as filed. */
  readonly name: string;
  /** Jurisdiction of registration, when confirmed. */
  readonly registeredIn?: string;
  readonly registeredAddress: RegisteredAddress;
  /** Companies House number, when confirmed. Never copied between companies. */
  readonly companyNumber?: string;
  /** VAT registration number, when confirmed. Never copied between companies. */
  readonly vatNumber?: string;
};

const NEW_CAVENDISH_STREET: RegisteredAddress = {
  lines: ["156 New Cavendish Street", "Marylebone", "London W1W 6YW", "United Kingdom"],
  inline: "156 New Cavendish Street, Marylebone, London W1W 6YW, United Kingdom",
  postal: {
    streetAddress: "156 New Cavendish Street",
    addressLocality: "London",
    addressRegion: "Marylebone",
    postalCode: "W1W 6YW",
    addressCountry: "GB",
  },
};

export const LEGAL_ENTITIES: Readonly<Record<LegalEntityId, LegalEntity>> = {
  "london-auction-xchange": {
    id: "london-auction-xchange",
    name: "London Auction Xchange LTD",
    registeredIn: "England and Wales",
    registeredAddress: NEW_CAVENDISH_STREET,
  },
  "london-art-exchange": {
    id: "london-art-exchange",
    name: "London Art Exchange Ltd",
    registeredAddress: NEW_CAVENDISH_STREET,
  },
};

/** Which company operates each product. LAX Account is provided by both. */
const PRODUCT_OPERATORS: Readonly<Record<LaxBrandProduct, readonly LegalEntityId[]>> = {
  bid: ["london-auction-xchange"],
  shop: ["london-art-exchange"],
  art: ["london-art-exchange"],
  account: ["london-auction-xchange", "london-art-exchange"],
};

/** A product with a single operating company. */
export type LaxOperatedProduct = Exclude<LaxBrandProduct, "account">;

/** How each product is written. The gallery is always "lax.art", never "LAX Art". */
export const LAX_PRODUCT_NAMES: Readonly<Record<LaxBrandProduct, string>> = {
  bid: "LAX Bid",
  shop: "LAX Shop",
  art: "lax.art",
  account: "LAX Account",
};

/** The company that operates a product. */
export function legalEntityFor(product: LaxOperatedProduct): LegalEntity {
  const [id] = PRODUCT_OPERATORS[product];
  if (!id) throw new Error(`No legal entity for ${product}`);
  return LEGAL_ENTITIES[id];
}

/** Every company behind a product, in a stable order (one for most products, two for Account). */
export function legalEntitiesFor(product: LaxBrandProduct): readonly LegalEntity[] {
  return PRODUCT_OPERATORS[product].map((id) => LEGAL_ENTITIES[id]);
}

function joinNames(entities: readonly LegalEntity[]): string {
  const names = entities.map((entity) => entity.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The company names behind a product, joined for a sentence. */
export function legalEntityNamesFor(product: LaxBrandProduct): string {
  return joinNames(legalEntitiesFor(product));
}

/**
 * Who runs the product, as one sentence: "LAX Shop is operated by London Art Exchange Ltd." or,
 * for Account, "LAX Account is provided by London Auction Xchange LTD and London Art Exchange Ltd."
 */
export function legalOperatorSentence(product: LaxBrandProduct): string {
  const verb = product === "account" ? "provided" : "operated";
  return `${LAX_PRODUCT_NAMES[product]} is ${verb} by ${legalEntityNamesFor(product)}.`;
}

/** Copyright line for a product's footer, receipts and emails. */
export function productCopyrightLine(product: LaxBrandProduct, year = siteCopyrightYear()): string {
  return `© ${year} ${legalEntityNamesFor(product)}. All rights reserved.`;
}

export function siteCopyrightYear(): number {
  return new Date().getFullYear();
}

/** Visible placeholder for a company detail that has not been confirmed yet. */
export function legalPlaceholder(detail: string): string {
  return `[TO CONFIRM: ${detail}]`;
}

/** Registration facts for a "Who we are" block, with placeholders for anything unconfirmed. */
export function legalEntityFacts(entity: LegalEntity): {
  name: string;
  registeredIn: string;
  companyNumber: string;
  vatNumber: string;
  registeredAddress: string;
} {
  return {
    name: entity.name,
    registeredIn:
      entity.registeredIn ??
      legalPlaceholder(`country of registration of ${entity.name}, for example England and Wales`),
    companyNumber: entity.companyNumber ?? legalPlaceholder(`${entity.name} company number`),
    vatNumber: entity.vatNumber ?? legalPlaceholder(`${entity.name} VAT registration number`),
    registeredAddress: entity.registeredAddress.inline,
  };
}
