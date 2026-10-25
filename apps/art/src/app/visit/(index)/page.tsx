import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtPrivateViewingSection } from "@/components/enquiry/art-private-viewing-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { composeVisitPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingCardReveal,
  MarketingPageTitle,
  MarketingReveal,
  MarketingVenueCard,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visit | lax.art",
  description: "Opening hours, addresses and private viewings at London Art Exchange galleries.",
  alternates: { canonical: "/visit" },
};

export default async function VisitPage() {
  const [result, viewer] = await Promise.all([
    composeVisitPage(artServices),
    artServices.viewer.load(),
  ]);
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Visit information coming soon"
          disabledDescription="Gallery visit content is not enabled in this environment yet."
          emptyTitle="No venues listed"
          emptyDescription="Visit details will appear here when venues are published."
        />
      </div>
    );
  }

  const { title, intro, venues } = result.data;

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 pb-10 lg:pb-16")}>
      <MarketingPageTitle title={title} />

      {intro ? (
        <p className="m-0 mx-auto max-w-3xl text-center text-base leading-relaxed text-on-surface md:text-xl">
          {intro}
        </p>
      ) : null}

      {venues.length === 0 ? (
        <ArtStatusState
          variant="empty"
          layout="inline"
          title="No venues listed"
          description="Visit details will appear here when venues are published."
        />
      ) : (
        <MarketingReveal index={0}>
          <section aria-labelledby="our-galleries" className="flex flex-col gap-6">
            <h2
              id="our-galleries"
              className="m-0 font-headline text-3xl font-medium text-on-surface md:text-4xl"
            >
              Our galleries
            </h2>
            <ul
              className="m-0 grid list-none gap-x-6 gap-y-10 p-0 md:grid-cols-2"
              aria-label="Galleries"
            >
              {venues.map((venue, index) => (
                <li key={venue.slug} data-testid="art-venue-card">
                  <MarketingCardReveal index={index}>
                    <MarketingVenueCard
                      href={venue.href}
                      name={venue.name}
                      addressLines={venue.addressLines}
                      headingLevel="h3"
                      image={
                        <ArtMediaImage
                          src={venue.imageUrl}
                          alt=""
                          label="Gallery"
                          placeholderTitle={venue.name}
                          priority={index === 0}
                          sizes="(min-width: 48rem) 45vw, 100vw"
                          className="absolute inset-0 size-full"
                          imgClassName="object-cover"
                        />
                      }
                    />
                  </MarketingCardReveal>
                </li>
              ))}
            </ul>
          </section>
        </MarketingReveal>
      )}

      <ArtPrivateViewingSection viewer={viewer} />
    </div>
  );
}
