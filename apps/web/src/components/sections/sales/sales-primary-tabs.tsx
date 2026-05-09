"use client";

import {
  type CalendarPrimaryTab,
  type CalendarSalesUrlState,
  calendarSalesHrefFromState,
} from "@/lib/marketing/sales-calendar-params";
import { cn } from "@auction/ui";
import Link from "next/link";

const TABS: { id: CalendarPrimaryTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live Now" },
  { id: "results", label: "Auction Results" },
  { id: "newLots", label: "New Lots" },
  { id: "privateSales", label: "Private Sales" },
  { id: "artists", label: "Artists" },
];

type Props = {
  state: CalendarSalesUrlState;
};

export function SalesPrimaryTabs({ state }: Props) {
  return (
    <div className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        aria-label="Calendar sections"
        className="inline-flex min-w-full items-start gap-6 border-b border-[#D1D1D1] pb-0 sm:gap-10 lg:min-w-0 lg:gap-12"
      >
        {TABS.map((t) => {
          const isActive = state.tab === t.id;
          const href = calendarSalesHrefFromState(state, { tab: t.id });
          return (
            <Link
              key={t.id}
              href={href}
              className={cn(
                "shrink-0 whitespace-nowrap pb-1.5 font-body text-base font-semibold uppercase leading-5 text-[#1C170D] transition-colors duration-200 ease-out dark:text-on-surface lg:text-lg lg:leading-[21px]",
                "border-b-[1.5px] border-transparent hover:text-[#050505] dark:hover:text-on-surface",
                "motion-safe:transition-[color,border-color] motion-safe:duration-200",
                isActive &&
                  "border-black text-[#050505] dark:border-on-surface dark:text-on-surface",
                !isActive && "border-transparent",
              )}
              aria-current={isActive ? "page" : undefined}
              prefetch={false}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
