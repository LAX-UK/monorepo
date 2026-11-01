import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";

const DESCRIPTION = "Every sale’s prices and sell-through, published within a day of the close.";

export function ResultsHero() {
  return (
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
      className="mb-8 !px-0 !py-0 md:mb-10 md:!py-2"
    />
  );
}
