import { ArtPageHeader } from "@/components/art-page-header";
import { ArtVenueFacts } from "@/components/editorial/art-venue-facts";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtPrivateViewingSection } from "@/components/enquiry/art-private-viewing-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { composeVenuePage, venueHref } from "@/lib/editorial/editorial-pages.composer";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
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

  const { venue, body } = result.data;
  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 py-6 lg:py-10")}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
        <div className="flex flex-col gap-8">
          <ArtPageHeader
            title={venue.name}
            breadcrumbs={[{ label: "Visit", href: "/visit" }, { label: venue.name }]}
          />
          <ArtVenueFacts facts={result.data} />
        </div>
        {venue.coverUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-container">
            <ArtMediaImage
              src={venue.coverUrl}
              alt={`${venue.name} gallery`}
              priority
              sizes="(min-width: 64rem) 50vw, 100vw"
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          </div>
        ) : null}
      </div>
      <EditorialBlockRenderer body={body} idPrefix={`venue-${venue.slug}`} className="max-w-3xl" />
      <ArtPrivateViewingSection
        viewer={viewer}
        returnTo={venueHref(venue.slug)}
        venue={{ slug: venue.slug, name: venue.name }}
      />
    </article>
  );
}
