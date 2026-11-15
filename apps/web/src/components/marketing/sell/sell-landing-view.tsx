import type { FaqItem } from "@/components/marketing/faq/faq-data";
import { SellPrivateSalesNote } from "@/components/marketing/sell/sell-closing-cta";
import { SellDepartmentGrid } from "@/components/marketing/sell/sell-department-grid";
import { SellHero } from "@/components/marketing/sell/sell-hero";
import { SellRecentlySold } from "@/components/marketing/sell/sell-recently-sold";
import { SellTemplateSections } from "@/components/marketing/sell/sell-template-sections";
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
      <SellTemplateSections
        specialists={specialists}
        faqItems={faqItems}
        closingSource="sell_closing"
        closingFootnote={<SellPrivateSalesNote />}
        afterSteps={<SellDepartmentGrid />}
      />
    </div>
  );
}
