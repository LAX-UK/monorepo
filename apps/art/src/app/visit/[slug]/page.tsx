import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtVenueLocation } from "@/components/editorial/art-venue-location";
import { ArtVenueRelatedLinks } from "@/components/editorial/art-venue-related-links";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { ArtMediaPageTitle } from "@/components/layout/art-media-page-title";
import { artServices } from "@/lib/art-services.server";
import { venueMetaLines } from "@/lib/editorial/editorial-page-title.vm";
import { composeVenuePage, venueHref } from "@/lib/editorial/editorial-pages.composer";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle, MarketingSubNav } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { cache } from "react";

type VenuePageProps = {
  params: Promise<{ slug: string }>;
};

const loadVenue = cache((slug: string) => composeVenuePage(artServices, slug));

const SECTION_HEADING = "m-0 font-headline text-3xl font-medium text-on-surface md:text-4xl";

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const result = await loadVenue((await params).slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Venue");
  const { venue, addressLine } = result.data;
  return {
    title: `${venue.name} | Visit | lax.art`,
    description: addressLine
      ? `Opening hours, directions and private viewings at ${venue.name}, ${addressLine}.`
      : `Opening hours and private viewings at ${venue.name}.`,
    alternates: { canonical: venueHref(venue.slug) },
    ...(venue.coverUrl ? { openGraph: { images: [venue.coverUrl] } } : {}),
  };
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { slug } = await params;
  const [result, viewer] = await Promise.all([loadVenue(slug), artServices.viewer.load()]);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Venue");

  const { venue, body, addressLine, hours, hasLocation, exhibitions, sectionTabs } = result.data;
  const meta = venueMetaLines(addressLine, hours);
  return (
    <article className="flex flex-col gap-12">
      {venue.coverUrl ? (
        <ArtMediaPageTitle
          variant="media"
          title={venue.name}
          image={{ src: venue.coverUrl, alt: `${venue.name} gallery` }}
          priority
          meta={meta}
        />
      ) : (
        <MarketingPageTitle title={venue.name} meta={meta} />
      )}
      {sectionTabs.length > 0 ? (
        <MarketingSubNav
          mode="anchor"
          sticky
          ariaLabel="Venue sections"
          items={sectionTabs}
          identity={{ title: venue.name, meta: addressLine, imageSrc: venue.coverUrl }}
        />
      ) : null}
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-16")}>
        {body.blocks.length > 0 ? (
          <EditorialBlockRenderer
            body={body}
            idPrefix={`venue-${venue.slug}`}
            className="mx-auto w-full max-w-3xl"
          />
        ) : null}
        {hasLocation ? (
          <section id="location" aria-labelledby="venue-location-title" className="scroll-mt-32">
            <div className="flex flex-col gap-8">
              <h2 id="venue-location-title" className={SECTION_HEADING}>
                Location
              </h2>
              <ArtVenueLocation facts={result.data} />
            </div>
          </section>
        ) : null}
        {exhibitions.length > 0 ? (
          <section
            id="exhibitions"
            aria-labelledby="venue-exhibitions-title"
            className="flex scroll-mt-32 flex-col gap-8"
          >
            <h2 id="venue-exhibitions-title" className={SECTION_HEADING}>
              Current exhibitions
            </h2>
            <ArtEditorialCardGrid cards={exhibitions} ariaLabel="Current exhibitions" />
          </section>
        ) : null}
        <ArtGalleryTeamBand
          team={buildArtGalleryTeam({
            context: "venue",
            subject: { slug: venue.slug, label: venue.name },
          })}
          viewer={viewer}
        />
      </div>
      <ArtVenueRelatedLinks />
    </article>
  );
}
