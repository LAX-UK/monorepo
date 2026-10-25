import { ART_LEGAL_INDEX_HREF, artLegalLinks } from "@/lib/layout/art-legal-links";
import {
  loadArtPolicyVisibility,
  loadLinkableArtPolicies,
} from "@/lib/legal/art-policy-publication.server";
import { NOINDEX_ROBOTS } from "@/lib/seo/art-indexing";
import { LAX_PRODUCT_NAMES } from "@auction/branding";
import {
  LAX_ART_LEGAL_INDEX,
  LAX_ART_POLICIES,
  type LaxArtPolicySlug,
  LegalPolicyIndex,
  LegalPolicyPage,
} from "@auction/marketing-ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function artPolicyMetadata(slug: LaxArtPolicySlug): Metadata {
  const policy = LAX_ART_POLICIES[slug];
  return {
    title: `${policy.document.title} | ${LAX_PRODUCT_NAMES.art}`,
    description: policy.description,
    alternates: { canonical: policy.artPath },
    ...(loadArtPolicyVisibility(slug) === "published" ? {} : { robots: NOINDEX_ROBOTS }),
  };
}

function hubLinks(current: LaxArtPolicySlug | null) {
  return [
    {
      href: ART_LEGAL_INDEX_HREF,
      label: LAX_ART_LEGAL_INDEX.title,
      current: current === null,
    },
    ...artLegalLinks(loadLinkableArtPolicies()).map((link) => ({
      href: link.href,
      label: link.label,
      current: link.slug === current,
    })),
  ];
}

/** One of London Art Exchange Ltd's policies, read from the source LAX Shop shares. */
export function ArtPolicyPageView({ slug }: { slug: LaxArtPolicySlug }) {
  const visibility = loadArtPolicyVisibility(slug);
  if (visibility === "hidden") notFound();
  const policy = LAX_ART_POLICIES[slug];
  return (
    <LegalPolicyPage
      document={policy.document}
      release={policy.release}
      draft={visibility === "draft-preview"}
      hubLabel="Legal"
      hubLinks={hubLinks(slug)}
      company="art"
    />
  );
}

export const artLegalIndexMetadata: Metadata = {
  title: `${LAX_ART_LEGAL_INDEX.title} | ${LAX_PRODUCT_NAMES.art}`,
  description: LAX_ART_LEGAL_INDEX.intro,
  alternates: { canonical: ART_LEGAL_INDEX_HREF },
};

/** The legal index: every policy, grouped as on the business team's page. */
export function ArtLegalIndexView() {
  const linkable = new Set(loadLinkableArtPolicies());
  return (
    <LegalPolicyIndex
      hrefFor={(slug) => LAX_ART_POLICIES[slug].artPath}
      isListed={(slug) => linkable.has(slug)}
      hubLabel="Legal"
      hubLinks={hubLinks(null)}
    />
  );
}
