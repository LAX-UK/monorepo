import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { sellContactHref, sellIntakeHref } from "@/lib/marketing/sell-intake";
import { SELL_HERO_LEAD, SELL_HERO_TITLE, SELL_TALK_LABEL } from "@/lib/marketing/sell-landing";
import { buttonVariants } from "@auction/ui/lax/button-variants";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

/** The top of the selling page: what is offered, and the two ways to begin. */
export function SellHero() {
  return (
    <section className={MARKETING_PAGE_SHELL}>
      <MarketingPageHero
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Sell", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        title={SELL_HERO_TITLE}
        titleSize="lg"
        description={SELL_HERO_LEAD}
        actions={
          <>
            <SellCtaLink
              href={sellIntakeHref()}
              source="sell_hero"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "max-md:w-full")}
            >
              {SELL_A_WORK_LABEL}
            </SellCtaLink>
            <Link
              href={sellContactHref()}
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "max-md:w-full")}
            >
              {SELL_TALK_LABEL}
            </Link>
          </>
        }
        className="mb-2 !max-w-[var(--container-inner,1376px)] !px-0 !py-0 md:mb-4 md:!py-2"
      />
    </section>
  );
}
