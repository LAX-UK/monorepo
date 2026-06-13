"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import { MARKETING_FILTER_RAIL_IN_SHEET } from "@/lib/marketing/filter-rail";
import {
  type CalendarSalesUrlState,
  calendarClearFiltersHref,
  countActiveCalendarFilters,
} from "@/lib/marketing/sales-calendar-params";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Category = { id: string; name: string };

export type SalesCalendarFilterSheetProps = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  resultCountLabel: string;
};

/** Mobile filter sheet for the sales calendar browse on `/sales`. */
export function SalesCalendarFilterSheet({
  state,
  resultCount,
  categories,
  years,
  resultCountLabel,
}: SalesCalendarFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const activeCount = countActiveCalendarFilters(state);
  const close = useCallback(() => setOpen(false), []);

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      trigger={<MarketingFilterTrigger activeCount={activeCount} />}
      applyLabel={resultCountLabel}
      onApply={close}
      onReset={() => {
        router.push(calendarClearFiltersHref(state));
        close();
      }}
    >
      <SalesFilterSidebar
        state={state}
        resultCount={resultCount}
        categories={categories}
        years={years}
        showResultCount={false}
        onLinkClick={close}
        className={MARKETING_FILTER_RAIL_IN_SHEET}
      />
    </MarketingFilterSheet>
  );
}
