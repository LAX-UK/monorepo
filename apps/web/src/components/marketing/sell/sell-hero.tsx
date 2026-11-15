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

type Props = {
  /** Department pages pass their own heading; the landing uses the shared one. */
  title?: string;
  lead?: string;
  /** Breadcrumb for a department page, under Sell. */
  breadcrumbLabel?: string;
  /** Category the form opens with. */
  categorySlug?: string;
  /** Kind of enquiry "Talk to a specialist" opens. */
  contactType?: Parameters<typeof sellContactHref>[0];
  /** Analytics source of the "Sell a work" link. */
  source?: string;
};

/** The top of the selling pages: what is offered, and the two ways to begin. */
export function SellHero({
  title = SELL_HERO_TITLE,
  lead = SELL_HERO_LEAD,
  breadcrumbLabel,
  categorySlug,
  contactType,
  source = "sell_hero",
}: Props = {}) {
  return (
    <section className={MARKETING_PAGE_SHELL}>
      <MarketingPageHero
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              breadcrumbLabel ? { label: "Sell", href: "/sell" } : { label: "Sell", current: true },
              ...(breadcrumbLabel ? [{ label: breadcrumbLabel, current: true }] : []),
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        title={title}
        titleSize="lg"
        description={lead}
        actions={
          <>
            <SellCtaLink
              href={sellIntakeHref(categorySlug ? { categorySlug } : undefined)}
              source={source}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "max-md:w-full")}
            >
              {SELL_A_WORK_LABEL}
            </SellCtaLink>
            <Link
              href={sellContactHref(contactType)}
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
