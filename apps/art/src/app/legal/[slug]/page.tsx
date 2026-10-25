import { editorialPageMetadata } from "@/components/editorial/art-editorial-page-view";
import { ArtLegalPageView } from "@/components/legal/art-legal-page-view";
import { ArtNoticePageView, artNoticeMetadata } from "@/components/legal/art-notice-page-view";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import { isArtNoticeSlug } from "@/lib/legal/art-notice-publication";
import type { Metadata } from "next";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

const legalRoute = (slug: string) => `/legal/${encodeURIComponent(slug)}`;

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isArtNoticeSlug(slug)) return artNoticeMetadata(slug);
  return editorialPageMetadata(await loadEditorialPage(slug), "Legal", {
    notFoundWhenDisabled: true,
  });
}

/**
 * The privacy notice and cookie policy are written in code and shared with LAX Shop; the other
 * legal pages come from the CMS.
 */
export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  if (isArtNoticeSlug(slug)) return <ArtNoticePageView slug={slug} />;
  const result = await loadEditorialPage(slug);
  return <ArtLegalPageView result={result} routeFor={legalRoute} />;
}
