import { SITE_COMPANY_NAME } from "./site.js";

/** Official LAX social destinations — shared across marketing surfaces. */
export const LAX_SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@londonauctionxchange",
  instagram: "https://www.instagram.com/lax.bid",
  linkedin: "https://www.linkedin.com/company/london-auction-xchange/",
} as const;

export type LaxSocialNetwork = keyof typeof LAX_SOCIAL_LINKS;

export const LAX_SOCIAL_ARIA_LABELS: Record<LaxSocialNetwork, string> = {
  youtube: `${SITE_COMPANY_NAME} on YouTube`,
  instagram: `${SITE_COMPANY_NAME} on Instagram`,
  linkedin: `${SITE_COMPANY_NAME} on LinkedIn`,
};
