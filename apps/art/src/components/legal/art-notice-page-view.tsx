import { visibleArtLegalLinks } from "@/lib/layout/art-legal-links";
import {
  loadArtNoticeVisibility,
  loadLinkableArtNotices,
} from "@/lib/legal/art-notice-publication.server";
import { NOINDEX_ROBOTS } from "@/lib/seo/art-indexing";
import { LAX_PRODUCT_NAMES } from "@auction/branding";
import {
  ART_EXCHANGE_NOTICES,
  ART_EXCHANGE_NOTICE_RELEASES,
  type ArtExchangeNoticeSlug,
  LegalPolicyPage,
} from "@auction/marketing-ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const noticePath = (slug: ArtExchangeNoticeSlug) => `/legal/${slug}`;

export function artNoticeMetadata(slug: ArtExchangeNoticeSlug): Metadata {
  const document = ART_EXCHANGE_NOTICES[slug];
  const visibility = loadArtNoticeVisibility(slug);
  return {
    title: `${document.title} | ${LAX_PRODUCT_NAMES.art}`,
    description: document.summary,
    alternates: { canonical: noticePath(slug) },
    ...(visibility === "published" ? {} : { robots: NOINDEX_ROBOTS }),
  };
}

/** London Art Exchange Ltd's privacy notice or cookie policy, shared with LAX Shop. */
export function ArtNoticePageView({ slug }: { slug: ArtExchangeNoticeSlug }) {
  const visibility = loadArtNoticeVisibility(slug);
  if (visibility === "hidden") notFound();
  const links = visibleArtLegalLinks(loadLinkableArtNotices()).map((link) => ({
    href: link.href,
    label: link.label,
    current: link.slug === slug,
  }));
  return (
    <LegalPolicyPage
      document={ART_EXCHANGE_NOTICES[slug]}
      release={ART_EXCHANGE_NOTICE_RELEASES[slug]}
      draft={visibility === "draft-preview"}
      hubLabel="Legal"
      hubLinks={links}
    />
  );
}
