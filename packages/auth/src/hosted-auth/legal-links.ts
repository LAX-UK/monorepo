import type { LegalAcceptanceProduct } from "../ports/legal-acceptance-recorder.js";
import type { HostedAuthProduct } from "./flow-context.js";
import type { HostedAuthCapabilities } from "./view.js";

/** The terms and privacy notice a person agrees to when they create an account. */
export type HostedAgreementLinks = { terms: string; privacy: string };

/** The footer's links, which are LAX Account's own whichever product sent the person. */
export type HostedFooterLinks = { privacy: string; help: string };

type OriginKey = "bidOrigin" | "shopOrigin" | "artOrigin";
type PublishedDocuments = { origin: OriginKey; terms: string; privacy: string };

/**
 * LAX Account's policies are the ones LAX Bid publishes (London Auction Xchange LTD), as Account's
 * own footer links them. LAX Shop and lax.art publish London Art Exchange Ltd's policies on their
 * own sites. Each product's documents name its own company (legal entities in @auction/branding).
 */
const ACCOUNT_DOCUMENTS: PublishedDocuments = {
  origin: "bidOrigin",
  terms: "/terms",
  privacy: "/privacy",
};

const DOCUMENTS: Readonly<Record<HostedAuthProduct, PublishedDocuments>> = {
  bid: ACCOUNT_DOCUMENTS,
  account: ACCOUNT_DOCUMENTS,
  unknown: ACCOUNT_DOCUMENTS,
  shop: { origin: "shopOrigin", terms: "/terms", privacy: "/privacy" },
  "shop-admin": { origin: "shopOrigin", terms: "/terms", privacy: "/privacy" },
  art: { origin: "artOrigin", terms: "/legal/terms", privacy: "/legal/privacy" },
};

/** The product whose documents the sign-up page links, as the record of acceptance names it. */
const LEGAL_PRODUCT: Readonly<Record<HostedAuthProduct, LegalAcceptanceProduct>> = {
  bid: "bid",
  account: "account",
  unknown: "account",
  shop: "shop",
  "shop-admin": "shop",
  art: "art",
};

const ACCOUNT_HELP = "/faq";

/** Which product's Terms and Privacy notice a person is shown when they sign up through `product`. */
export function hostedLegalProduct(product: HostedAuthProduct): LegalAcceptanceProduct {
  return LEGAL_PRODUCT[product];
}

function absolute(capabilities: HostedAuthCapabilities, origin: OriginKey, path: string): string {
  return new URL(path, capabilities[origin]).toString();
}

/** The documents of the product the person is signing up through. */
export function hostedAgreementLinks(
  product: HostedAuthProduct,
  capabilities: HostedAuthCapabilities,
): HostedAgreementLinks {
  const documents = DOCUMENTS[product];
  return {
    terms: absolute(capabilities, documents.origin, documents.terms),
    privacy: absolute(capabilities, documents.origin, documents.privacy),
  };
}

export function hostedFooterLinks(capabilities: HostedAuthCapabilities): HostedFooterLinks {
  return {
    privacy: absolute(capabilities, ACCOUNT_DOCUMENTS.origin, ACCOUNT_DOCUMENTS.privacy),
    help: absolute(capabilities, ACCOUNT_DOCUMENTS.origin, ACCOUNT_HELP),
  };
}
