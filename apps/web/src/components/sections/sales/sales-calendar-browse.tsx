"use client";

import { SalesFilterChips } from "@/components/sections/sales/sales-filter-chips";
import {
  SalesFilterSheetProvider,
  useSalesFilterSheet,
} from "@/components/sections/sales/sales-filter-context";
import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { countActiveCalendarFilters } from "@/lib/marketing/sales-calendar-params";
import { CALENDAR_FILTERS_PANEL_ID } from "@/lib/marketing/sales-filter-scroll";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@auction/ui";
import type { ReactNode } from "react";

type Category = { id: string; name: string };

type InnerProps = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  children: ReactNode;
};

function SalesCalendarBrowseInner({ state, resultCount, categories, years, children }: InnerProps) {
  const { mobileFiltersOpen, setMobileFiltersOpen, openMobileFilters } = useSalesFilterSheet();
  const filterCount = countActiveCalendarFilters(state);

  return (
    <div className="relative flex w-full flex-col gap-6">
      <SalesFilterChips state={state} categories={categories} />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="fixed bottom-4 right-4 z-40 min-h-[44px] shadow-md lg:hidden"
        onClick={openMobileFilters}
      >
        Filters{filterCount > 0 ? ` (${filterCount})` : ""}
      </Button>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-outline-variant/30"
        >
          <SheetHeader>
            <SheetTitle className="text-left font-headline text-lg">Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <SalesFilterSidebar
              state={state}
              resultCount={resultCount}
              categories={categories}
              years={years}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="pt-2 sm:pt-4">
        <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-0">
          <div
            id={CALENDAR_FILTERS_PANEL_ID}
            className="hidden shrink-0 lg:block lg:w-[min(100%,441px)] lg:max-w-[441px] lg:pr-8"
          >
            <SalesFilterSidebar
              state={state}
              resultCount={resultCount}
              categories={categories}
              years={years}
            />
          </div>
          <div className="min-w-0 flex-1 pb-20 lg:max-w-[989px] lg:pb-0 lg:pl-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SalesCalendarBrowse(props: InnerProps) {
  return (
    <SalesFilterSheetProvider>
      <SalesCalendarBrowseInner {...props} />
    </SalesFilterSheetProvider>
  );
}
