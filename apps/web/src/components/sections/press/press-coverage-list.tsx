import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { MarketingCardReveal } from "@auction/marketing-ui/motion/index";
import { DisplayHeading } from "@auction/ui/components/typography";
import { ButtonLink } from "@auction/ui/lax/button-link";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PressArchiveEntryVM } from "./mappers";
import { PressCoverageCard } from "./press-coverage-card";

type Props = {
  items: PressArchiveEntryVM[];
  /** What to show: from `resolvePressPageState`. */
  view: "empty" | "filteredEmpty" | "list";
  toolbar?: ReactNode;
};

export function PressCoverageList({ items, view, toolbar }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <MarketingSectionHeader
        heading={
          <DisplayHeading
            as="h2"
            id="press-coverage-archive-title"
            size="section"
            className="font-semibold text-on-surface"
          >
            Press coverage
          </DisplayHeading>
        }
        subtitle="External articles mentioning LAX sales."
      />

      {toolbar}

      {view === "empty" ? (
        <MarketingEmptyState
          variant="marketing"
          context="noResults"
          illustration="press"
          headingLevel="h3"
          title="No coverage yet"
          description="Articles about LAX Bid sales will appear here."
          action={
            <ButtonLink Link={Link} variant="primary" href="/contact?intent=press">
              Contact the press office
            </ButtonLink>
          }
        />
      ) : view === "filteredEmpty" ? (
        <MarketingEmptyState
          variant="marketing"
          context="filtered"
          illustration="press"
          headingLevel="h3"
          title="No articles match"
          description="Try adjusting your search or year filter."
          action={
            <ButtonLink Link={Link} variant="primary" href="/press">
              Clear filters
            </ButtonLink>
          }
        />
      ) : (
        <ol
          className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Press coverage archive"
        >
          {items.map((item, index) => (
            <li key={`${item.url}-${item.saleId}-${index}`}>
              <MarketingCardReveal index={index} className="h-full min-w-0">
                <PressCoverageCard
                  item={item}
                  saleContext={{ href: item.salePressHref, title: item.saleTitle }}
                />
              </MarketingCardReveal>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
