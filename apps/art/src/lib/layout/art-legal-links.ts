import { LAX_ART_POLICIES, type LaxArtPolicySlug } from "@auction/marketing-ui";

export type ArtLegalLink = { slug: LaxArtPolicySlug; label: string; href: string };

/** The legal index on lax.art, which lists every policy. */
export const ART_LEGAL_INDEX_HREF = "/legal";

/**
 * London Art Exchange Ltd's policies that this deployment may link to, in index order; the
 * footer and the policy menu beside each legal page use the same list.
 */
export function artLegalLinks(linkable: readonly LaxArtPolicySlug[]): ArtLegalLink[] {
  return linkable.map((slug) => ({
    slug,
    label: LAX_ART_POLICIES[slug].label,
    href: LAX_ART_POLICIES[slug].artPath,
  }));
}
