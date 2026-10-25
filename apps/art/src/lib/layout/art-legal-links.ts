import type { ArtExchangeNoticeSlug } from "@auction/marketing-ui";

/** lax.art's legal pages, in footer order; the legal page list beside each page uses the same. */
export const ART_LEGAL_LINKS = [
  { slug: "privacy", label: "Privacy notice", href: "/legal/privacy" },
  { slug: "cookies", label: "Cookie policy", href: "/legal/cookies" },
  { slug: "returns", label: "Returns policy", href: "/legal/returns" },
  { slug: "shipping", label: "Shipping and delivery", href: "/legal/shipping" },
  { slug: "terms", label: "Terms and conditions", href: "/legal/terms" },
  { slug: "accessibility", label: "Accessibility", href: "/legal/accessibility" },
  { slug: "modern-slavery", label: "Modern slavery statement", href: "/legal/modern-slavery" },
] as const;

export type ArtLegalLink = (typeof ART_LEGAL_LINKS)[number];

/**
 * The legal links this deployment may show. The privacy notice and cookie policy are written in
 * code and left out while they are drafts hidden on production; the other pages come from the CMS.
 */
export function visibleArtLegalLinks(
  linkableNotices: readonly ArtExchangeNoticeSlug[],
): ArtLegalLink[] {
  return ART_LEGAL_LINKS.filter(
    (link) =>
      (link.slug !== "privacy" && link.slug !== "cookies") || linkableNotices.includes(link.slug),
  );
}
