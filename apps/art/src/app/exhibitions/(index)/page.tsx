import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtExhibitionReveal } from "@/components/exhibition/art-exhibition-reveal";
import { artServices } from "@/lib/art-services.server";
import {
  EXHIBITION_STATUS_TABS,
  composeExhibitionsPage,
  parseExhibitionStatus,
} from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingReveal, MarketingSubNav } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exhibitions | lax.art",
  description: "Current, upcoming and past exhibitions from the London Art Exchange gallery.",
  alternates: { canonical: "/exhibitions" },
};

const EMPTY_COPY = {
  current: "There are no exhibitions on right now. See what's coming up next.",
  upcoming: "Upcoming exhibitions will be announced here.",
  past: "Past exhibitions will be archived here.",
} as const;

type ExhibitionsPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

export default async function ExhibitionsPage({ searchParams }: ExhibitionsPageProps) {
  const status = parseExhibitionStatus((await searchParams).status);
  const result = await composeExhibitionsPage(artServices, status);
  const hasHero = result.status === "ok" && result.data.featured.length > 0;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Figma has no page title here: the hero carries the visual title, so the h1 is for
          assistive tech. Without a hero the page shows its title, as the artworks index does. */}
      {hasHero ? (
        <>
          <h1 className="sr-only">Exhibitions</h1>
          <ArtExhibitionReveal items={result.data.featured} />
        </>
      ) : null}
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8", !hasHero && "pt-6 lg:pt-10")}>
        {hasHero ? null : <ArtPageHeader title="Exhibitions" />}
        {result.status === "disabled" ? null : (
          <MarketingSubNav
            ariaLabel="Exhibition dates"
            active={status}
            items={EXHIBITION_STATUS_TABS.map((tab) => ({
              id: tab.value,
              label: tab.label,
              href: tab.value === "current" ? "/exhibitions" : `/exhibitions?status=${tab.value}`,
            }))}
          />
        )}
        {result.status !== "ok" ? (
          <ArtEditorialStatus
            result={result}
            disabledTitle="Exhibitions coming soon"
            disabledDescription="Editorial exhibitions are not enabled in this environment yet."
            emptyTitle="No exhibitions found"
            emptyDescription={EMPTY_COPY[status]}
          />
        ) : result.data.cards.length === 0 ? (
          <ArtStatusState
            variant="empty"
            title="Nothing to show yet"
            description={EMPTY_COPY[status]}
          />
        ) : (
          <MarketingReveal index={1}>
            <ArtEditorialCardGrid
              cards={result.data.cards}
              ariaLabel="Exhibitions"
              priorityCount={3}
            />
          </MarketingReveal>
        )}
      </div>
    </div>
  );
}
