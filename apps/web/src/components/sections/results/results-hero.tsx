import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";

const DESCRIPTION = "Every sale’s prices and sell-through, published within a day of the close.";

export function ResultsHero() {
  return (
    <section className={MARKETING_PAGE_SHELL}>
      <MarketingPageHero
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Results", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        title="Results"
        titleSize="lg"
        description={DESCRIPTION}
        className="mb-8 !max-w-[var(--container-inner,1376px)] !px-0 !py-0 md:mb-10 md:!py-2"
      />
    </section>
  );
}
