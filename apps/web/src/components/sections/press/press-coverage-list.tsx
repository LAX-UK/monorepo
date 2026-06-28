import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { EMPTY_STATE_VOICE } from "@/lib/ui/empty-state-copy";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PressArchiveEntryVM } from "./mappers";
import { PressCoverageCard } from "./press-coverage-card";

type Props = {
  items: PressArchiveEntryVM[];
  hasActiveFilters?: boolean;
  toolbar?: ReactNode;
};

export function PressCoverageList({ items, hasActiveFilters = false, toolbar }: Props) {
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

      {items.length === 0 ? (
        <MarketingEmptyState
          variant="marketing"
          context={hasActiveFilters ? "filtered" : "noResults"}
          illustration="press"
          title={
            hasActiveFilters ? EMPTY_STATE_VOICE.filteredTitle("articles") : "No press coverage yet"
          }
          description={
            hasActiveFilters
              ? "Try adjusting your search or year filter."
              : "Check back as new coverage is added to our sales."
          }
          action={
            hasActiveFilters ? (
              <Button variant="cta" asChild>
                <Link href="/press">Clear filters</Link>
              </Button>
            ) : undefined
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
