import { editorialPageMetadata } from "@/components/editorial/art-editorial-page-view";
import { ArtLegalPageView } from "@/components/legal/art-legal-page-view";
import { ArtPolicyPageView, artPolicyMetadata } from "@/components/legal/art-policy-page-view";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import { isLaxArtPolicySlug } from "@auction/marketing-ui";
import type { Metadata } from "next";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

const legalRoute = (slug: string) => `/legal/${encodeURIComponent(slug)}`;

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isLaxArtPolicySlug(slug)) return artPolicyMetadata(slug);
  return editorialPageMetadata(await loadEditorialPage(slug), "Legal", {
    notFoundWhenDisabled: true,
  });
}

/**
 * London Art Exchange Ltd's policies are published from code and shared with LAX Shop; any other
 * legal page comes from the CMS.
 */
export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  if (isLaxArtPolicySlug(slug)) return <ArtPolicyPageView slug={slug} />;
  const result = await loadEditorialPage(slug);
  return <ArtLegalPageView result={result} routeFor={legalRoute} />;
}
