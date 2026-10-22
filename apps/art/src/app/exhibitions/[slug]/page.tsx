import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtExhibitionArtists } from "@/components/exhibition/art-exhibition-artists";
import { ArtExhibitionFacts } from "@/components/exhibition/art-exhibition-facts";
import { ArtExhibitionInstallationViews } from "@/components/exhibition/art-exhibition-installation-views";
import { ArtExhibitionPress } from "@/components/exhibition/art-exhibition-press";
import { ArtExhibitionSpecialist } from "@/components/exhibition/art-exhibition-specialist";
import { ArtExhibitionWorks } from "@/components/exhibition/art-exhibition-works.client";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import { exhibitionSectionTabs } from "@/lib/editorial/editorial-page-title.vm";
import { composeExhibitionDetailPage } from "@/lib/editorial/editorial-pages.composer";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingCtaBand, MarketingPageTitle, MarketingSubNav } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { cache } from "react";

type ExhibitionPageProps = {
  params: Promise<{ slug: string }>;
};

const loadExhibition = cache((slug: string) => composeExhibitionDetailPage(artServices, slug));

export async function generateMetadata({ params }: ExhibitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadExhibition(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Exhibition");
  const { exhibition } = result.data;
  return {
    title: `${exhibition.title} | LAX Art`,
    ...(exhibition.summary ? { description: exhibition.summary } : {}),
    alternates: { canonical: `/exhibitions/${encodeURIComponent(exhibition.slug)}` },
    openGraph: {
      title: exhibition.title,
      ...(exhibition.summary ? { description: exhibition.summary } : {}),
      ...(exhibition.coverUrl ? { images: [{ url: exhibition.coverUrl }] } : {}),
    },
  };
}

export default async function ExhibitionDetailPage({ params }: ExhibitionPageProps) {
  const { slug } = await params;
  const result = await loadExhibition(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Exhibition");

  const { exhibition, metaLine, ended, dateLabel, facts, body, works, artists, press } =
    result.data;
  const { viewer, favoriteAuth } = result.data;
  const hasOverview = body.blocks.length > 0;
  const hasInstallationViews = exhibition.installationMedia.length > 0;
  const sectionTabs = exhibitionSectionTabs({
    overview: hasOverview,
    works: works.length > 0,
    artists: artists.length > 0,
    press: press.length > 0,
  });
  const title = {
    title: exhibition.title,
    eyebrow: ended ? "Closed" : null,
    subtitle: exhibition.summary,
    meta: [metaLine],
  };

  return (
    <article className="flex flex-col">
      {exhibition.coverUrl ? (
        <MarketingPageTitle
          variant="media"
          image={{ src: exhibition.coverUrl }}
          priority
          {...title}
        />
      ) : (
        <MarketingPageTitle {...title} />
      )}
      {sectionTabs.length > 0 ? (
        <MarketingSubNav
          mode="anchor"
          sticky
          ariaLabel="Exhibition sections"
          items={sectionTabs}
          identity={{
            title: exhibition.title,
            meta: dateLabel,
            imageSrc: exhibition.coverUrl,
          }}
        />
      ) : null}
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 py-10 lg:gap-16 lg:pb-16")}>
        <ArtExhibitionFacts facts={facts} />
        <ArtExhibitionSpecialist contact={facts.contact} />
        {hasOverview ? (
          <div id="overview" className="mx-auto w-full max-w-3xl">
            <EditorialBlockRenderer body={body} />
          </div>
        ) : null}
        {works.length > 0 ? (
          <div id="works">
            <ArtSection id="works" title="Works">
              <ArtExhibitionWorks cards={works} favoriteAuth={favoriteAuth} />
            </ArtSection>
          </div>
        ) : null}
        {artists.length > 0 ? (
          <div id="featured-artists">
            <ArtSection id="featured-artists" title="Featured artists">
              <ArtExhibitionArtists artists={artists} />
            </ArtSection>
          </div>
        ) : null}
        {hasInstallationViews ? (
          <ArtSection id="installation-views" title="Installation views">
            <ArtExhibitionInstallationViews
              views={exhibition.installationMedia}
              exhibitionTitle={exhibition.title}
            />
          </ArtSection>
        ) : null}
        {press.length > 0 ? (
          <div id="press">
            <ArtSection id="press" title="Press">
              <ArtExhibitionPress items={press} />
            </ArtSection>
          </div>
        ) : null}
      </div>
      <MarketingCtaBand
        tone={ended ? "plain" : "feature"}
        title="Experience the exhibition in person"
        body="For further information or to arrange a private viewing, please contact our team. We are available to assist collectors, institutions and galleries."
        action={
          <ArtGeneralEnquiryPanel
            viewer={viewer}
            defaultTopic="private_viewing"
            contextSlug={exhibition.slug}
            contextLabel={exhibition.title}
            triggerLabel="Request a private viewing"
          />
        }
      />
    </article>
  );
}
