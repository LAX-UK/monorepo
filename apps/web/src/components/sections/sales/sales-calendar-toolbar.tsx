"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { SalesCalendarActiveFilters } from "@/components/sections/sales/sales-calendar-active-filters";
import { SalesCalendarFilterSheet } from "@/components/sections/sales/sales-calendar-filter-sheet";
import { SalesFilterChips } from "@/components/sections/sales/sales-filter-chips";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";

type Category = { id: string; name: string };

export type SalesCalendarToolbarProps = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  calendarView: "grid" | "list";
};

/** Sticky sales calendar toolbar: count + filter sheet + optional desktop quick chips + view. */
export function SalesCalendarToolbar({
  state,
  resultCount,
  categories,
  years,
  calendarView,
}: SalesCalendarToolbarProps) {
  const countLabel = `${resultCount} sale${resultCount === 1 ? "" : "s"}`;
  const resultCountLabel = resultCount === 1 ? "Show 1 sale" : `Show ${resultCount} sales`;

  return (
    <>
      <MarketingListToolbar
        countLabel={countLabel}
        mobileFilterTrigger={
          <SalesCalendarFilterSheet
            state={state}
            resultCount={resultCount}
            categories={categories}
            years={years}
            resultCountLabel={resultCountLabel}
          />
        }
        filters={<SalesFilterChips state={state} categories={categories} />}
        trailing={
          <CatalogViewSwitcher
            routeKey="sales"
            value={calendarView === "list" ? "list" : "grid"}
            supportedModes={["grid", "list"]}
          />
        }
      />
      <SalesCalendarActiveFilters state={state} categories={categories} />
    </>
  );
}
