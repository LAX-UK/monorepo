"use client";

import { SalesCalendarToolbar } from "@/components/sections/sales/sales-calendar-toolbar";
import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import {
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
} from "@/lib/marketing/chrome";
import type { SalesFacetCounts } from "@/lib/marketing/sales-calendar-facets";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { cn } from "@auction/ui/lib/utils";
import type { ReactNode } from "react";

type Category = { id: string; name: string };

type Props = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  /** Sales per rail option; null when they could not be counted. */
  facets: SalesFacetCounts | null;
  calendarView: SalesBrowseView;
  children: ReactNode;
};

export function SalesCalendarBrowse({
  state,
  resultCount,
  categories,
  years,
  facets,
  calendarView,
  children,
}: Props) {
  return (
    <div className="relative flex w-full flex-col gap-6">
      <SalesCalendarToolbar
        state={state}
        resultCount={resultCount}
        categories={categories}
        years={years}
        facets={facets}
        calendarView={calendarView}
      />

      <div className={MARKETING_CATALOG_FILTER_GRID}>
        <div className={MARKETING_CATALOG_FILTER_RAIL_SLOT}>
          <SalesFilterSidebar
            state={state}
            resultCount={resultCount}
            categories={categories}
            years={years}
            facets={facets}
            showResultCount={false}
          />
        </div>
        <div
          className={cn(MARKETING_CATALOG_MAIN_COLUMN, "pb-[var(--page-bottom-padding)] lg:pb-0")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
