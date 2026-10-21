import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { artServices } from "@/lib/art-services.server";
import { composeCollectorHubPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingPageTitle, MarketingReveal } from "@auction/marketing-ui";
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
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 pb-10 lg:pb-16")}>
      <MarketingPageTitle
        title="Collector Hub"
        subtitle="From discovering your first work to exploring a more established art practice, LAX offers guidance at every stage."
      />
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
      {/* Figma closes the hub with a "Get in touch" band (782:11154). */}
      <Button
        asChild
        size="lg"
        className="mx-auto min-h-11 w-fit font-label uppercase tracking-wide"
      >
        <Link href="/contact">Get in touch</Link>
      </Button>
    </div>
  );
}
