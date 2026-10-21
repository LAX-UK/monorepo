import {
  ArtEditorialPageView,
  editorialPageMetadata,
} from "@/components/editorial/art-editorial-page-view";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { artServices } from "@/lib/art-services.server";
import { loadEditorialPage } from "@/lib/editorial/editorial-page.loader.server";
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

export default async function CollectorServicePage({ params }: CollectorServicePageProps) {
  const { slug } = await params;
  const [result, viewer] = await Promise.all([loadEditorialPage(slug), artServices.viewer.load()]);
  return (
    <ArtEditorialPageView
      result={result}
      routeFor={collectorRoute}
      notFoundWhenDisabled
      breadcrumbs={[{ label: "Collector Hub", href: "/collector-hub" }]}
      aside={
        <>
          <h2 className="font-headline text-xl font-semibold text-on-surface">
            Talk to an advisor
          </h2>
          <ArtGeneralEnquiryPanel
            viewer={viewer}
            defaultTopic="art_advisory"
            contextSlug={slug}
            {...(result.status === "ok" ? { contextLabel: result.data.title } : {})}
            triggerLabel="Request advice"
          />
        </>
      }
    />
  );
}
