import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import { composeArtHubPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Art Hub | LAX Art",
  description: "Films, guides and stories from the London Art Exchange gallery programme.",
  alternates: { canonical: "/art-hub" },
};

export default async function ArtHubPage() {
  const result = await composeArtHubPage(artServices);
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Art Hub coming soon"
          disabledDescription="Editorial programming is not enabled in this environment yet."
          emptyTitle="Art Hub is empty"
          emptyDescription="Spotlight stories and guides will appear here when published."
        />
      </div>
    );
  }

  const { spotlight, stories } = result.data;

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 py-10")}>
      <header className="max-w-3xl">
        <h1 className="font-headline text-3xl font-semibold text-on-surface">Art Hub</h1>
        <p className="mt-2 text-on-surface-variant">
          Films, guides, and stories from the London Art Exchange gallery programme.
        </p>
      </header>
      {spotlight.length === 0 && stories.length === 0 ? (
        <ArtStatusState
          variant="empty"
          layout="inline"
          title="Nothing published yet"
          description="New Art Hub features will appear here when they are published."
        />
      ) : null}
      {spotlight.length > 0 ? (
        <MarketingReveal index={0}>
          <ArtSection id="art-hub-spotlight" title="Spotlight">
            <ArtEditorialCardGrid cards={spotlight} ariaLabel="Spotlight" priorityCount={3} />
          </ArtSection>
        </MarketingReveal>
      ) : null}
      {stories.length > 0 ? (
        <MarketingReveal index={1}>
          <ArtSection id="art-hub-stories" title="Stories, films and guides">
            <ArtEditorialCardGrid
              cards={stories}
              ariaLabel="Stories, films and guides"
              {...(spotlight.length === 0 ? { priorityCount: 3 } : {})}
            />
          </ArtSection>
        </MarketingReveal>
      ) : null}
    </div>
  );
}
