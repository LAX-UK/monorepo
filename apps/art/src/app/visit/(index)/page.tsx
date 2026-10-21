import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtVenueFacts } from "@/components/editorial/art-venue-facts";
import { ArtPrivateViewingSection } from "@/components/enquiry/art-private-viewing-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { composeVisitPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingCardMedia, MarketingReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Visit | LAX Art",
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

  const { venues } = result.data;

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 py-6 lg:py-10")}>
      <ArtPageHeader
        title="Visit"
        description="Plan your visit to London Art Exchange gallery spaces, or book a private viewing."
      />

      {venues.length === 0 ? (
        <ArtStatusState
          variant="empty"
          layout="inline"
          title="No venues listed"
          description="Visit details will appear here when venues are published."
        />
      ) : (
        <MarketingReveal index={0}>
          <ul className="grid gap-x-6 gap-y-12 md:grid-cols-2" aria-label="Galleries">
            {venues.map((card, index) => (
              <li
                key={card.venue.slug}
                className="flex flex-col gap-5"
                data-testid="art-venue-card"
              >
                <MarketingCardMedia className="aspect-[4/3] bg-surface-container">
                  <ArtMediaImage
                    src={card.venue.coverUrl}
                    alt=""
                    label="Gallery"
                    priority={index === 0}
                    sizes="(min-width: 48rem) 45vw, 100vw"
                    className="absolute inset-0 size-full"
                    imgClassName="object-cover"
                  />
                </MarketingCardMedia>
                <h2 className="font-headline text-2xl font-semibold text-on-surface">
                  <Link href={card.href} className="art-focus-ring rounded-sm hover:underline">
                    {card.venue.name}
                  </Link>
                </h2>
                <ArtVenueFacts facts={card} compact />
                <Link
                  href={card.href}
                  className="art-focus-ring w-fit rounded-sm font-label text-sm font-semibold uppercase tracking-wide text-on-surface underline underline-offset-4 hover:no-underline"
                >
                  Plan your visit<span className="sr-only"> to {card.venue.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </MarketingReveal>
      )}

      <ArtPrivateViewingSection viewer={viewer} returnTo="/visit" />
    </div>
  );
}
