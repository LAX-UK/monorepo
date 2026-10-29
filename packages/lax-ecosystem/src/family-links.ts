import { LAX_FAMILY_NAMES, LAX_FAMILY_ORDER } from "@auction/branding";
import type { ProductDirectoryConfig } from "./product-directory.js";

/**
 * Everything the LAX top bar links to, in its order: the three products, then LAX Account, which
 * they share. A new product is added here and to the product directory, not to each header.
 */
export const LAX_FAMILY_IDS = LAX_FAMILY_ORDER;
export type LaxFamilyMemberId = (typeof LAX_FAMILY_IDS)[number];

export type LaxFamilyLinkVm = {
  id: LaxFamilyMemberId;
  label: string;
  href: string;
  /** The product the person is on; the bar marks it and phone menus leave it out. */
  current: boolean;
};

export type LaxFamilyLinksInput = {
  current: LaxFamilyMemberId;
  /** A member without a configured URL is left out rather than guessed. */
  hrefs: Readonly<Partial<Record<LaxFamilyMemberId, string | undefined>>>;
};

/** The top bar's links, named as the family writes them ("lax.art", "lax.shop", ...). */
export function buildLaxFamilyLinks(input: LaxFamilyLinksInput): LaxFamilyLinkVm[] {
  return LAX_FAMILY_IDS.flatMap((id) => {
    const href = input.hrefs[id]?.trim();
    if (!href) return [];
    return [{ id, label: LAX_FAMILY_NAMES[id], href, current: id === input.current }];
  });
}

export const LOCAL_LAX_ACCOUNT_ORIGIN = "http://localhost:3040";
export const DEFAULT_LAX_ACCOUNT_ORIGIN = "https://account.lax.bid";

/**
 * Where LAX Account lives for a product's links: the configured origin, or, when unset, the local
 * Account dev server outside production and the live portal in production, as every product and
 * the sign-in service resolve it.
 */
export function resolveLaxAccountOrigin(
  configured: string | undefined,
  nodeEnv: string | undefined,
): string {
  const origin = configured?.trim().replace(/\/+$/, "");
  if (origin) return origin;
  return nodeEnv === "production" ? DEFAULT_LAX_ACCOUNT_ORIGIN : LOCAL_LAX_ACCOUNT_ORIGIN;
}

/**
 * The top bar's links for a product whose sibling URLs come from the product directory, with
 * that product's link to LAX Account.
 */
export function buildLaxFamilyLinksFromDirectory(
  config: ProductDirectoryConfig,
  accountHref: string | undefined,
): LaxFamilyLinkVm[] {
  return buildLaxFamilyLinks({
    current: config.currentProductId,
    hrefs: {
      bid: config.bidPublicUrl,
      art: config.artPublicUrl,
      shop: config.shopStorefrontUrl,
      account: accountHref,
    },
  });
}
