import { LAX_PRODUCT_NAMES } from "@auction/branding";
import type { ProductDirectoryConfig } from "./product-directory.js";

/**
 * Everything the LAX top bar links to, in its order: the three products, then LAX Account, which
 * they share. A new product is added here and to the product directory, not to each header.
 */
export const LAX_FAMILY_IDS = ["bid", "art", "shop", "account"] as const;
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

/** The top bar's links, named as the brand writes them ("LAX Bid", "lax.art", ...). */
export function buildLaxFamilyLinks(input: LaxFamilyLinksInput): LaxFamilyLinkVm[] {
  return LAX_FAMILY_IDS.flatMap((id) => {
    const href = input.hrefs[id]?.trim();
    if (!href) return [];
    return [{ id, label: LAX_PRODUCT_NAMES[id], href, current: id === input.current }];
  });
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
