import { editorialPageMetadata } from "@/components/editorial/art-editorial-page-view";
import { ArtLegalPageView } from "@/components/legal/art-legal-page-view";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import type { Metadata } from "next";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

const legalRoute = (slug: string) => `/legal/${encodeURIComponent(slug)}`;

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage((await params).slug), "Legal", {
    notFoundWhenDisabled: true,
  });
}

export default async function LegalPage({ params }: LegalPageProps) {
  const result = await loadEditorialPage((await params).slug);
  return <ArtLegalPageView result={result} routeFor={legalRoute} />;
}
