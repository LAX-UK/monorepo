import type { FaqItem } from "@/components/marketing/faq/faq-data";
import { SellClosingCta, SellPrivateSalesNote } from "@/components/marketing/sell/sell-closing-cta";
import { SellDepartmentGrid } from "@/components/marketing/sell/sell-department-grid";
import { SellFaq } from "@/components/marketing/sell/sell-faq";
import { SellFees } from "@/components/marketing/sell/sell-fees";
import { SellHero } from "@/components/marketing/sell/sell-hero";
import { SellRecentlySold } from "@/components/marketing/sell/sell-recently-sold";
import { SellSpecialistsSection } from "@/components/marketing/sell/sell-specialists-section";
import { SellSteps } from "@/components/marketing/sell/sell-steps";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { SellSpecialist } from "@/lib/marketing/sell-specialists";
import type { LotMediaTreatmentIndex } from "@auction/domain";
import type { Lot } from "@auction/types";

type Props = {
  recentlySold: readonly Lot[];
  treatments: LotMediaTreatmentIndex;
  specialists: readonly SellSpecialist[];
  faqItems: readonly FaqItem[];
};

/** The selling landing: what we sell, how it works, what it costs and how to begin. */
export function SellLandingView({ recentlySold, treatments, specialists, faqItems }: Props) {
  return (
    <div className="bg-page-bg pt-[calc(var(--header-height)+1.5rem)] dark:bg-background">
      <SellHero />
      <SellRecentlySold works={recentlySold} treatments={treatments} />
      <SellSteps />
      <SellDepartmentGrid />
      <SellFees />
      <SellSpecialistsSection specialists={specialists} />
      <SellFaq items={faqItems} />
      <section className={`${MARKETING_PAGE_SHELL} py-16 md:py-24`}>
        <SellClosingCta source="sell_closing" footnote={<SellPrivateSalesNote />} />
      </section>
    </div>
  );
}
