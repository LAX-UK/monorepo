"use client";

import { MarketingUnderlineTabs } from "@/components/marketing/marketing-underline-tabs";
import {
  type CalendarSalesUrlState,
  calendarSalesHrefFromState,
  getCalendarPrimaryTabDefinitions,
} from "@/lib/marketing/sales-calendar-params";

type Props = {
  state: CalendarSalesUrlState;
  hasLiveSales?: boolean;
};

export function SalesPrimaryTabs({ state, hasLiveSales = false }: Props) {
  const tabs = getCalendarPrimaryTabDefinitions(hasLiveSales);

  return (
    <div className="w-full overflow-x-auto scroll-pl-4 scroll-pr-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <MarketingUnderlineTabs
        variant="route"
        ariaLabel="Calendar sections"
        tabs={tabs.map((t) => ({
          id: t.id,
          label: t.label,
          href: calendarSalesHrefFromState(state, { tab: t.id, page: undefined }),
          active: state.tab === t.id,
          scroll: false,
        }))}
      />
    </div>
  );
}
