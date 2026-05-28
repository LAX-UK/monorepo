"use client";

import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
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

const triggerClass = cn(
  "inline-flex min-h-[40px] snap-start items-center gap-1.5 rounded-full border border-outline-variant/40 bg-transparent px-3 font-body text-sm font-medium text-nav-text outline-none transition-colors hover:bg-surface-container-high dark:border-outline-variant/50 dark:text-on-surface",
  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg",
);

/** Desktop quick filters for delivery, category, and location (toolbar strip). */
export function SalesFilterChips({ state, categories }: Props) {
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
    <MarketingChipStrip aria-label="Quick filters">
      <DropdownMenu>
        <DropdownMenuTrigger type="button" className={triggerClass}>
          {deliveryLabel}
          <ChevronDown className="size-5 shrink-0 opacity-90" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem asChild>
            <Link
              href={calendarSalesHrefFromState(state, { deliveryMode: "all", page: undefined })}
            >
              All types
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={calendarSalesHrefFromState(state, { deliveryMode: "online", page: undefined })}
            >
              Online
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={calendarSalesHrefFromState(state, { deliveryMode: "onsite", page: undefined })}
            >
              Live
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger type="button" className={triggerClass}>
          {categoryLabel}
          <ChevronDown className="size-5 shrink-0 opacity-90" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48 max-h-72 overflow-y-auto">
          <DropdownMenuItem asChild>
            <Link
              href={calendarSalesHrefFromState(state, { categoryId: undefined, page: undefined })}
            >
              All categories
            </Link>
          </DropdownMenuItem>
          {categories.map((c) => (
            <DropdownMenuItem key={c.id} asChild>
              <Link href={calendarSalesHrefFromState(state, { categoryId: c.id, page: undefined })}>
                {c.name}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger type="button" className={triggerClass}>
          {locationLabel}
          <ChevronDown className="size-5 shrink-0 opacity-90" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem asChild>
            <Link href={calendarSalesHrefFromState(state, { location: "all", page: undefined })}>
              All locations
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={calendarSalesHrefFromState(state, { location: "online", page: undefined })}>
              Online
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={calendarSalesHrefFromState(state, { location: "london", page: undefined })}>
              London
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </MarketingChipStrip>
  );
}
