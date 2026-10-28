import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtHubFeatureCard } from "@/components/editorial/art-hub-feature-card";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { artServices } from "@/lib/art-services.server";
import { composeCollectorHubPage } from "@/lib/editorial/editorial-pages.composer";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingCardReveal, MarketingPageTitle, MarketingReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collector Hub | lax.art",
  description: "Advisory, collection care and ways to work with the London Art Exchange team.",
  alternates: { canonical: "/collector-hub" },
};

export default async function CollectorHubPage() {
  const [result, viewer] = await Promise.all([
    composeCollectorHubPage(artServices),
    artServices.viewer.load(),
  ]);
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

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 pb-10 lg:pb-16")}>
      <MarketingPageTitle
        title="Collector Hub"
        subtitle="From discovering your first work to exploring a more established art practice, LAX offers guidance at every stage."
      />
      {cards.length === 0 ? (
        <ArtStatusState
          variant="empty"
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
      <ArtGalleryTeamBand
        team={buildArtGalleryTeam({ context: "advisory" })}
        viewer={viewer}
        className="mt-6 lg:mt-14"
      />
    </div>
  );
}
