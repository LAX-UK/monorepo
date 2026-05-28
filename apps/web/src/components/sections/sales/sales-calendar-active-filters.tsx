"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import {
  type CalendarSalesUrlState,
  buildCalendarActiveFilterChips,
  calendarClearFiltersHref,
} from "@/lib/marketing/sales-calendar-params";

type Category = { id: string; name: string };

type Props = {
  state: CalendarSalesUrlState;
  categories: Category[];
  className?: string;
};

/** Removable active filter chips for the sales calendar (parity with search/saleroom). */
export function SalesCalendarActiveFilters({ state, categories, className }: Props) {
  const chips = buildCalendarActiveFilterChips(state, categories);
  const clearHref = calendarClearFiltersHref(state);

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref={clearHref}
      {...(className ? { className } : {})}
    />
  );
}
