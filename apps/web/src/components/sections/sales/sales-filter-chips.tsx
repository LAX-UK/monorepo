"use client";

import { useSalesFilterSheet } from "@/components/sections/sales/sales-filter-context";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import { cn } from "@auction/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

type Category = { id: string; name: string };

type Props = {
  state: CalendarSalesUrlState;
  categories: Category[];
};

export function SalesFilterChips({ state, categories }: Props) {
  const { openMobileFilters } = useSalesFilterSheet();

  const categoryLabel = state.categoryId
    ? (categories.find((c) => c.id === state.categoryId)?.name ?? "Category")
    : "Category";

  const deliveryLabel =
    state.deliveryMode === "online"
      ? "Online"
      : state.deliveryMode === "onsite"
        ? "Live"
        : "Auction Type";

  const locationLabel =
    state.location === "all" ? "Location" : state.location === "online" ? "Online" : state.location;

  return (
    <div className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-full items-center gap-6 border-b border-[#D1D1D1] pb-2 sm:gap-10 md:min-w-0 md:gap-12">
        <button
          type="button"
          onClick={openMobileFilters}
          className="inline-flex h-10 items-center gap-1.5 border-r border-black pr-3 font-body text-sm font-medium text-[#1C170D] transition-opacity hover:opacity-80 lg:hidden dark:border-on-surface dark:text-on-surface"
        >
          Filters
          <svg
            width="25"
            height="23"
            viewBox="0 0 25 23"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden
          >
            <title>Filters icon</title>
            <path
              d="M21.5 14.787H9.145M4.784 14.787H3M4.784 14.787C4.784 14.2088 5.01368 13.6543 5.42251 13.2455C5.83134 12.8367 6.38583 12.607 6.964 12.607C7.54217 12.607 8.09666 12.8367 8.50549 13.2455C8.91432 13.6543 9.144 14.2088 9.144 14.787C9.144 15.3652 8.91432 15.9197 8.50549 16.3285C8.09666 16.7373 7.54217 16.967 6.964 16.967C6.38583 16.967 5.83134 16.7373 5.42251 16.3285C5.01368 15.9197 4.784 15.3652 4.784 14.787ZM21.5 8.18H18.395M14.034 8.18H3M14.034 8.18C14.034 7.60183 14.2637 7.04734 14.6725 6.63851C15.0813 6.22968 15.6358 6 16.214 6C16.5003 6 16.7838 6.05639 17.0483 6.16594C17.3127 6.2755 17.5531 6.43608 17.7555 6.63851C17.9579 6.84094 18.1185 7.08126 18.2281 7.34575C18.3376 7.61024 18.394 7.89372 18.394 8.18C18.394 8.46628 18.3376 8.74976 18.2281 9.01425C18.1185 9.27874 17.9579 9.51906 17.7555 9.72149C17.5531 9.92392 17.3127 10.0845 17.0483 10.1941C16.7838 10.3036 16.5003 10.36 16.214 10.36C15.6358 10.36 15.0813 10.1303 14.6725 9.72149C14.2637 9.31266 14.034 8.75817 14.034 8.18Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeMiterlimit="10"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 font-body text-sm font-medium text-[#1C170D] outline-none transition-opacity hover:opacity-80 dark:text-on-surface",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            )}
          >
            {deliveryLabel}
            <ChevronDown className="size-5 shrink-0 opacity-90" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { deliveryMode: "all" })}>
                All types
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { deliveryMode: "online" })}>
                Online
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { deliveryMode: "onsite" })}>Live</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 font-body text-sm font-medium text-[#1C170D] outline-none transition-opacity hover:opacity-80 dark:text-on-surface",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            )}
          >
            {categoryLabel}
            <ChevronDown className="size-5 shrink-0 opacity-90" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48 max-h-72 overflow-y-auto">
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { categoryId: undefined })}>
                All categories
              </Link>
            </DropdownMenuItem>
            {categories.map((c) => (
              <DropdownMenuItem key={c.id} asChild>
                <Link href={calendarSalesHrefFromState(state, { categoryId: c.id })}>{c.name}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 font-body text-sm font-medium text-[#1C170D] outline-none transition-opacity hover:opacity-80 dark:text-on-surface",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            )}
          >
            {locationLabel}
            <ChevronDown className="size-5 shrink-0 opacity-90" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { location: "all" })}>
                All locations
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { location: "online" })}>Online</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={calendarSalesHrefFromState(state, { location: "london" })}>London</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
