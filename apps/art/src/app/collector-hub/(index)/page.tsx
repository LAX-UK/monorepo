import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { artServices } from "@/lib/art-services.server";
import { composeCollectorHubPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Collector Hub | LAX Art",
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

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 py-10")}>
      <header className="flex max-w-3xl flex-col gap-4">
        <h1 className="font-headline text-3xl font-semibold text-on-surface">Collector Hub</h1>
        <p className="text-on-surface-variant">
          Advisory notes, collection care, and ways to work with the gallery team.
        </p>
        <Button asChild size="lg" className="min-h-11 w-fit font-label uppercase tracking-wide">
          <Link href="/contact">Talk to an advisor</Link>
        </Button>
      </header>
      {result.data.cards.length === 0 ? (
        <ArtStatusState
          variant="empty"
          layout="inline"
          title="Collector resources on the way"
          description="Guides and advisory notes will appear here when they are published."
        />
      ) : (
        <MarketingReveal index={0}>
          <ArtEditorialCardGrid cards={result.data.cards} ariaLabel="Collector resources" />
        </MarketingReveal>
      )}
    </div>
  );
}
