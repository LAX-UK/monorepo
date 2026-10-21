import { ArtVenueFacts } from "@/components/editorial/art-venue-facts";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtPrivateViewingSection } from "@/components/enquiry/art-private-viewing-section";
import { artServices } from "@/lib/art-services.server";
import { venueMetaLines } from "@/lib/editorial/editorial-page-title.vm";
import { composeVenuePage, venueHref } from "@/lib/editorial/editorial-pages.composer";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { cache } from "react";

type VenuePageProps = {
  params: Promise<{ slug: string }>;
};

const loadVenue = cache((slug: string) => composeVenuePage(artServices, slug));

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const result = await loadVenue((await params).slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Venue");
  const { venue, addressLine } = result.data;
  return {
    title: `${venue.name} | Visit | LAX Art`,
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

  const { venue, body, addressLine, hours } = result.data;
  const meta = venueMetaLines(addressLine, hours);
  return (
    <article className="flex flex-col gap-12 pb-10 lg:pb-16">
      {venue.coverUrl ? (
        <MarketingPageTitle
          variant="media"
          title={venue.name}
          image={{ src: venue.coverUrl, alt: `${venue.name} gallery` }}
          priority
          meta={meta}
        />
      ) : (
        <MarketingPageTitle title={venue.name} meta={meta} />
      )}
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12")}>
        <ArtVenueFacts facts={result.data} />
        <EditorialBlockRenderer
          body={body}
          idPrefix={`venue-${venue.slug}`}
          className="max-w-3xl"
        />
        <ArtPrivateViewingSection
          viewer={viewer}
          returnTo={venueHref(venue.slug)}
          venue={{ slug: venue.slug, name: venue.name }}
        />
      </div>
    </article>
  );
}
