import { type LaxOperatedProduct, type LegalEntityId, legalEntityFor } from "./legal-entity.js";

export const LAX_SOCIAL_NETWORKS = ["youtube", "instagram", "linkedin"] as const;
export type LaxSocialNetwork = (typeof LAX_SOCIAL_NETWORKS)[number];

const NETWORK_NAMES: Record<LaxSocialNetwork, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

/**
 * Each company's own social profiles. A profile belongs to the company that runs it, so a product
 * links only to its operator's accounts: footers and the structured data `sameAs` never tie one
 * company to the other's profiles. London Art Exchange's handles (lax.art and LAX Shop) are added
 * here once confirmed; until then those products show none.
 */
const SOCIAL_PROFILES: Readonly<
  Record<LegalEntityId, Readonly<Partial<Record<LaxSocialNetwork, string>>>>
> = {
  "london-auction-xchange": {
    youtube: "https://www.youtube.com/@londonauctionxchange",
    instagram: "https://www.instagram.com/lax.bid",
    linkedin: "https://www.linkedin.com/company/london-auction-xchange/",
  },
  "london-art-exchange": {},
};

export type SocialProfileLink = {
  network: LaxSocialNetwork;
  href: string;
  /** "London Auction Xchange on YouTube": names the company that runs the profile. */
  label: string;
};

/** The product's operator's social profiles, in footer order; empty when none are confirmed. */
export function socialProfilesFor(product: LaxOperatedProduct): SocialProfileLink[] {
  const operator = legalEntityFor(product);
  const profiles = SOCIAL_PROFILES[operator.id];
  return LAX_SOCIAL_NETWORKS.flatMap((network) => {
    const href = profiles[network];
    return href
      ? [{ network, href, label: `${operator.tradingName} on ${NETWORK_NAMES[network]}` }]
      : [];
  });
}

/** Whether the product has any profiles to show, so a footer can leave out an empty Connect column. */
export function hasSocialProfiles(product: LaxOperatedProduct): boolean {
  return socialProfilesFor(product).length > 0;
}
