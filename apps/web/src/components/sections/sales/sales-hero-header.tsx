import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { DisplayHeading } from "@auction/ui";

const SUBTITLE =
  "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design, and luxury.";

/** Calendar rail — title + blurb via `MarketingPageHero`. */
export function SalesHeroHeader() {
  return (
    <MarketingPageHero
      breadcrumb={
        <MarketingBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Calendar", current: true },
          ]}
          className={MARKETING_HUB_BREADCRUMB_CLASS}
        />
      }
      title={
        <DisplayHeading as="h1" size="section" className="font-semibold">
          Calendar
        </DisplayHeading>
      }
      className="!max-w-[var(--container-inner,1376px)] !px-0"
      description={
        <div className="max-w-2xl font-body text-base text-on-surface-variant md:text-lg dark:text-on-surface/70">
          {SUBTITLE}
        </div>
      }
    />
  );
}
