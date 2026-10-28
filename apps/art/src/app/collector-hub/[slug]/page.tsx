import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { artServices } from "@/lib/art-services.server";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import type { Metadata } from "next";

type CollectorServicePageProps = {
  params: Promise<{ slug: string }>;
};

const collectorRoute = (slug: string) => `/collector-hub/${encodeURIComponent(slug)}`;

export async function generateMetadata({ params }: CollectorServicePageProps): Promise<Metadata> {
  return editorialPageMetadata(await loadEditorialPage((await params).slug), "Collector Hub", {
    notFoundWhenDisabled: true,
  });
}

/** A Collector Hub service page (art advisory, collection care): the guidance, then an advisor. */
export default async function CollectorServicePage({ params }: CollectorServicePageProps) {
  const { slug } = await params;
  const [result, viewer] = await Promise.all([loadEditorialPage(slug), artServices.viewer.load()]);
  const team = buildArtGalleryTeam({
    context: "advisory",
    subject: result.status === "ok" ? { slug, label: result.data.title } : null,
  });
  return (
    <ArtEditorialPageView
      result={result}
      routeFor={collectorRoute}
      notFoundWhenDisabled
      breadcrumbs={[{ label: "Collector Hub", href: "/collector-hub" }]}
      closing={<ArtGalleryTeamBand team={team} viewer={viewer} />}
    />
  );
}
