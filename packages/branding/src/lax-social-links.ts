/** Official LAX social destinations — shared across marketing surfaces. */
export const LAX_SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@londonauctionxchange",
  instagram: "https://www.instagram.com/lax.bid",
  linkedin: "https://www.linkedin.com/company/london-auction-xchange/",
} as const;

export type LaxSocialNetwork = keyof typeof LAX_SOCIAL_LINKS;

export const LAX_SOCIAL_ARIA_LABELS: Record<LaxSocialNetwork, string> = {
  youtube: "London Auction Xchange on YouTube",
  instagram: "London Auction Xchange on Instagram",
  linkedin: "London Auction Xchange on LinkedIn",
};
