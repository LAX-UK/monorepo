"use client";

import { SalesPriceSlider } from "@/components/sections/sales/sales-price-slider";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import type { SalesFilterSidebarGroupValue } from "@/lib/marketing/sales-filter-sidebar-catalog";
import { cn } from "@auction/ui";
import Link from "next/link";

const MONTHS = [
  { n: 1, label: "January" },
  { n: 2, label: "February" },
  { n: 3, label: "March" },
  { n: 4, label: "April" },
  { n: 5, label: "May" },
  { n: 6, label: "June" },
  { n: 7, label: "July" },
  { n: 8, label: "August" },
  { n: 9, label: "September" },
  { n: 10, label: "October" },
  { n: 11, label: "November" },
  { n: 12, label: "December" },
] as const;

type Category = { id: string; name: string };

export type SalesFilterGroupContentsProps = {
  group: SalesFilterSidebarGroupValue;
  state: CalendarSalesUrlState;
  categories: Category[];
  years: number[];
};

/** AccordionContent `className` per group (layout scroll / spacing). */
export const salesFilterAccordionContentClass: Record<SalesFilterSidebarGroupValue, string> = {
  sort: "flex flex-col gap-2 pb-4",
  price: "pb-4",
  department: "flex max-h-60 flex-col gap-2 overflow-y-auto pb-4",
  month: "flex max-h-52 flex-col gap-1 overflow-y-auto pb-4",
  year: "flex max-h-52 flex-col gap-1 overflow-y-auto pb-4",
};

export function SalesFilterGroupContents({
  group,
  state,
  categories,
  years,
}: SalesFilterGroupContentsProps) {
  switch (group) {
    case "sort":
      return (
        <>
          <Link
            href={calendarSalesHrefFromState(state, { sort: "startAsc" })}
            className={cn(
              "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
              state.sort === "startAsc" && "font-semibold text-[#050505] dark:text-on-surface",
            )}
          >
            Start date (soonest first)
          </Link>
          <Link
            href={calendarSalesHrefFromState(state, { sort: "createdDesc" })}
            className={cn(
              "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
              state.sort === "createdDesc" && "font-semibold text-[#050505] dark:text-on-surface",
            )}
          >
            Newly listed
          </Link>
        </>
      );
    case "price":
      return <SalesPriceSlider state={state} />;
    case "department":
      return (
        <>
          <Link
            href={calendarSalesHrefFromState(state, { categoryId: undefined })}
            className={cn(
              "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
              !state.categoryId && "font-semibold text-[#050505] dark:text-on-surface",
            )}
          >
            All departments
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={calendarSalesHrefFromState(state, { categoryId: c.id })}
              className={cn(
                "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
                state.categoryId === c.id && "font-semibold text-[#050505] dark:text-on-surface",
              )}
            >
              {c.name}
            </Link>
          ))}
        </>
      );
    case "month":
      return (
        <>
          <Link
            href={calendarSalesHrefFromState(state, { month: undefined })}
            className={cn(
              "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
              state.month == null && "font-semibold text-[#050505] dark:text-on-surface",
            )}
          >
            Any month
          </Link>
          {MONTHS.map((m) => (
            <Link
              key={m.n}
              href={calendarSalesHrefFromState(state, { month: m.n })}
              className={cn(
                "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
                state.month === m.n && "font-semibold text-[#050505] dark:text-on-surface",
              )}
            >
              {m.label}
            </Link>
          ))}
        </>
      );
    case "year":
      return (
        <>
          <Link
            href={calendarSalesHrefFromState(state, { year: undefined })}
            className={cn(
              "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
              state.year == null && "font-semibold text-[#050505] dark:text-on-surface",
            )}
          >
            Any year
          </Link>
          {years.map((y) => (
            <Link
              key={y}
              href={calendarSalesHrefFromState(state, { year: y })}
              className={cn(
                "font-body text-sm text-[#474747] hover:underline dark:text-on-surface-variant",
                state.year === y && "font-semibold text-[#050505] dark:text-on-surface",
              )}
            >
              {y}
            </Link>
          ))}
        </>
      );
  }
}
