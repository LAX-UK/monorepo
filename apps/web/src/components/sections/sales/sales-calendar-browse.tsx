"use client";

import { SalesCalendarToolbar } from "@/components/sections/sales/sales-calendar-toolbar";
import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import {
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
} from "@/lib/marketing/chrome";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Category = { id: string; name: string };

type Props = {
  state: CalendarSalesUrlState;
  resultCount: number;
  categories: Category[];
  years: number[];
  calendarView: SalesBrowseView;
  children: ReactNode;
};

export function SalesCalendarBrowse({
  state,
  resultCount,
  categories,
  years,
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
        calendarView={calendarView}
      />

      <div className={MARKETING_CATALOG_FILTER_GRID}>
        <div className={MARKETING_CATALOG_FILTER_RAIL_SLOT}>
          <SalesFilterSidebar
            state={state}
            resultCount={resultCount}
            categories={categories}
            years={years}
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
