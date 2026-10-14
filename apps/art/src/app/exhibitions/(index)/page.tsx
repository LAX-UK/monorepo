import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialCard, ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import {
  EXHIBITION_STATUS_TABS,
  composeExhibitionsPage,
  parseExhibitionStatus,
} from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { SectionTabs } from "@auction/ui/components/section-tabs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exhibitions | LAX Art",
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

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-10")}>
      <header className="flex flex-col gap-2">
        <h1 className="font-headline text-3xl font-semibold text-on-surface">Exhibitions</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Exhibitions, films and events from the London Art Exchange gallery programme.
        </p>
      </header>
      {result.status === "ok" && result.data.featured.length > 0 ? (
        <MarketingReveal index={0}>
          <ArtSection id="featured-exhibitions" title="Featured">
            <ArtRail id="featured-exhibitions-rail" label="Featured exhibitions">
              {result.data.featured.map((card, index) => (
                <ArtRailItem key={card.key} size="feature">
                  <ArtEditorialCard card={card} priority={index === 0} />
                </ArtRailItem>
              ))}
            </ArtRail>
          </ArtSection>
        </MarketingReveal>
      ) : null}
      {result.status === "disabled" ? null : (
        <SectionTabs
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
          layout="inline"
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
  );
}
