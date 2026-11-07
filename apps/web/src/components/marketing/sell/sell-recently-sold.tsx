import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { DepartmentWorkCard } from "@/components/marketing/department/department-work-card";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { SELL_SECTION_IDS } from "@/lib/marketing/sell-landing";
import { type LotMediaTreatmentIndex, lotMediaTreatment } from "@auction/domain";
import type { Lot } from "@auction/types";
import { ScrollRow } from "@auction/ui";

type Props = {
  works: readonly Lot[];
  /** How each department shows its lots, so a mixed row shows every work its own way. */
  treatments: LotMediaTreatmentIndex;
};

/**
 * Works the house has sold, each with the price it reached. A row of two on a phone that scrolls
 * sideways, a grid from a tablet up. Nothing is shown when nothing has sold.
 */
export function SellRecentlySold({ works, treatments }: Props) {
  if (works.length === 0) return null;
  return (
    <MarketingSection
      id={SELL_SECTION_IDS.recentlySold}
      heading="Recently sold"
      subtitle="Prices include the buyer’s premium."
      action={{ href: "/results?view=lots", label: "View all", srSuffix: "recently sold works" }}
    >
      <ViewItemListTracker
        listId="sell:recently-sold"
        listName="Sell: recently sold"
        itemIds={works.map((work) => work.id)}
      />
      <ScrollRow className="-mx-4 px-4 md:mx-0 md:px-0">
        <ul
          aria-label="Recently sold works"
          className="flex w-max gap-4 md:grid md:w-full md:grid-cols-3 md:gap-y-8 lg:gap-x-6 xl:grid-cols-4"
        >
          {works.map((lot) => (
            <li key={lot.id} className="w-[calc((100vw-3rem)/2)] min-w-0 md:w-auto">
              <DepartmentWorkCard
                lot={lot}
                displayStyle={lotMediaTreatment(lot, treatments).style}
              />
            </li>
          ))}
        </ul>
      </ScrollRow>
    </MarketingSection>
  );
}
