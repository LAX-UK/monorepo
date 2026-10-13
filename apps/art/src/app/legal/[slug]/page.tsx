import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import type { Metadata } from "next";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

const legalRoute = (slug: string) => `/legal/${encodeURIComponent(slug)}`;

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage((await params).slug), "Legal");
}

export default async function LegalPage({ params }: LegalPageProps) {
  const result = await loadEditorialPage((await params).slug);
  return <ArtEditorialPageView result={result} routeFor={legalRoute} notFoundWhenDisabled />;
}
