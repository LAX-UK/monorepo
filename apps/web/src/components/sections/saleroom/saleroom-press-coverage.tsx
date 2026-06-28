import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { PressCoverageCard } from "@/components/sections/press/press-coverage-card";
import type { PressCoverageVM } from "@/components/sections/saleroom/view-models";
import { DisplayHeading, cn } from "@auction/ui";

type Props = {
  items: PressCoverageVM[];
  className?: string;
};

/**
 * Public press coverage section (server component — no client state).
 * External links use rel="noopener noreferrer" only: these are curated editorial
 * endorsements so we intentionally pass link equity (no nofollow).
 */
export function SaleroomPressCoverage({ items, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <MarketingSectionHeader
        heading={
          <DisplayHeading as="h2" size="section" className="font-semibold text-on-surface">
            Press coverage
          </DisplayHeading>
        }
        subtitle="Coverage from the press and media."
      />

      <ol
        className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Press coverage articles"
      >
        {items.map((item, index) => (
          <li key={`${item.url}-${index}`}>
            <MarketingCardReveal index={index} className="h-full min-w-0">
              <PressCoverageCard item={item} />
            </MarketingCardReveal>
          </li>
        ))}
      </ol>
    </div>
  );
}
