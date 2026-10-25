import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtHubFeatureCard } from "@/components/editorial/art-hub-feature-card";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { composeCollectorHubPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingCardReveal,
  MarketingCtaBand,
  MarketingPageTitle,
  MarketingReveal,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Collector Hub | lax.art",
  description: "Advisory, collection care and ways to work with the London Art Exchange team.",
  alternates: { canonical: "/collector-hub" },
};

export default async function CollectorHubPage() {
  const result = await composeCollectorHubPage(artServices);
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Collector Hub coming soon"
          disabledDescription="Editorial collector content is not enabled in this environment yet."
          emptyTitle="Collector Hub is empty"
          emptyDescription="Collector resources will appear here when published."
        />
      </div>
    );
  }

  const { cards } = result.data;
  // The closing banner borrows the hub's own imagery; without any it falls back to a plain band.
  const bannerImage = cards.find((card) => card.imageUrl)?.imageUrl ?? null;

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 pb-10 lg:pb-16")}>
      <MarketingPageTitle
        title="Collector Hub"
        subtitle="From discovering your first work to exploring a more established art practice, LAX offers guidance at every stage."
      />
      {cards.length === 0 ? (
        <ArtStatusState
          variant="empty"
          layout="inline"
          title="Collector resources on the way"
          description="Guides and advisory notes will appear here when they are published."
        />
      ) : (
        <MarketingReveal index={0}>
          <ul
            className="m-0 grid list-none gap-6 p-0 md:grid-cols-2"
            aria-label="Collector resources"
          >
            {cards.map((card, index) => (
              <li key={card.key}>
                <MarketingCardReveal index={index}>
                  <ArtHubFeatureCard card={card} priority={index < 2} />
                </MarketingCardReveal>
              </li>
            ))}
          </ul>
        </MarketingReveal>
      )}
      <MarketingCtaBand
        title="Curious to learn more?"
        tone="feature"
        {...(bannerImage
          ? {
              media: (
                <ArtMediaImage
                  src={bannerImage}
                  alt=""
                  sizes="100vw"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              ),
            }
          : {})}
        action={
          <Button
            asChild
            variant="outline"
            size="lg"
            className="min-h-11 border-current bg-transparent text-inherit hover:bg-transparent hover:text-inherit hover:underline"
          >
            <Link href="/contact">Get in touch</Link>
          </Button>
        }
      />
    </div>
  );
}
