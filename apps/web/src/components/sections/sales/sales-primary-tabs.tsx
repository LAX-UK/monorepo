"use client";

import {
  type CalendarSalesUrlState,
  calendarSalesHrefFromState,
  getCalendarPrimaryTabDefinitions,
} from "@/lib/marketing/sales-calendar-params";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  state: CalendarSalesUrlState;
  hasLiveSales?: boolean;
};

export function SalesPrimaryTabs({ state, hasLiveSales = false }: Props) {
  const tabs = getCalendarPrimaryTabDefinitions(hasLiveSales);

  return (
    <div className="w-full overflow-x-auto scroll-pl-4 scroll-pr-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        aria-label="Calendar sections"
        className="inline-flex min-w-full items-start gap-5 border-b border-outline-variant pb-0 sm:gap-8 lg:min-w-0 lg:gap-12"
      >
        {tabs.map((t) => {
          const isActive = state.tab === t.id;
          const href = calendarSalesHrefFromState(state, { tab: t.id, page: undefined });
          return (
            <Link
              key={t.id}
              href={href}
              className={cn(
                "snap-start inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap py-2 font-body text-base font-semibold uppercase leading-5 text-nav-text transition-colors duration-200 ease-out sm:pb-1.5 lg:text-lg lg:leading-[21px]",
                "border-b-[1.5px] border-transparent hover:text-on-surface",
                "motion-safe:transition-[color,border-color] motion-safe:duration-200",
                "focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                isActive && "border-on-surface text-on-surface",
                !isActive && "border-transparent",
              )}
              aria-current={isActive ? "page" : undefined}
              prefetch={false}
              scroll={false}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
