"use client";

import { SalesCalendarToolbar } from "@/components/sections/sales/sales-calendar-toolbar";
import { SalesFilterSidebar } from "@/components/sections/sales/sales-filter-sidebar";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
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

      <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-0">
        <div className="hidden shrink-0 lg:block lg:w-[min(100%,441px)] lg:max-w-[441px] lg:pr-8">
          <SalesFilterSidebar
            state={state}
            resultCount={resultCount}
            categories={categories}
            years={years}
          />
        </div>
        <div className="min-w-0 flex-1 pb-[var(--page-bottom-padding)] lg:max-w-[989px] lg:pb-0 lg:pl-8">
          {children}
        </div>
      </div>
    </div>
  );
}
