"use client";

import { SalesPriceSlider } from "@/components/sections/sales/sales-price-slider";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import type { SalesFilterSidebarGroupValue } from "@/lib/marketing/sales-filter-sidebar-catalog";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

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
  onLinkClick?: () => void;
};

const linkClass = (active: boolean) =>
  cn(
    "font-body text-sm text-on-surface-variant hover:underline",
    active && "font-semibold text-on-surface",
  );

function FilterLink({
  href,
  active,
  children,
  onLinkClick,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  onLinkClick?: () => void;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={linkClass(active)}
      {...(onLinkClick ? { onClick: onLinkClick } : {})}
    >
      {children}
    </Link>
  );
}

/** AccordionContent `className` per group (layout scroll / spacing). */
export const salesFilterAccordionContentClass: Record<SalesFilterSidebarGroupValue, string> = {
  delivery: "flex flex-col gap-2 pb-4",
  location: "flex flex-col gap-2 pb-4",
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
  onLinkClick,
}: SalesFilterGroupContentsProps) {
  switch (group) {
    case "delivery":
      return (
        <>
          <FilterLink
            href={calendarSalesHrefFromState(state, { deliveryMode: "all", page: undefined })}
            active={state.deliveryMode === "all"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            All types
          </FilterLink>
          <FilterLink
            href={calendarSalesHrefFromState(state, { deliveryMode: "online", page: undefined })}
            active={state.deliveryMode === "online"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            Online
          </FilterLink>
          <FilterLink
            href={calendarSalesHrefFromState(state, { deliveryMode: "onsite", page: undefined })}
            active={state.deliveryMode === "onsite"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            In-person
          </FilterLink>
        </>
      );
    case "location":
      return (
        <>
          <FilterLink
            href={calendarSalesHrefFromState(state, { location: "all", page: undefined })}
            active={state.location === "all"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            All locations
          </FilterLink>
          <FilterLink
            href={calendarSalesHrefFromState(state, { location: "online", page: undefined })}
            active={state.location === "online"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            Online
          </FilterLink>
          <FilterLink
            href={calendarSalesHrefFromState(state, { location: "london", page: undefined })}
            active={state.location === "london"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            London
          </FilterLink>
        </>
      );
    case "sort":
      return (
        <>
          <FilterLink
            href={calendarSalesHrefFromState(state, { sort: "startAsc", page: undefined })}
            active={state.sort === "startAsc"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            Start date (soonest first)
          </FilterLink>
          <FilterLink
            href={calendarSalesHrefFromState(state, { sort: "createdDesc", page: undefined })}
            active={state.sort === "createdDesc"}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            Newly listed
          </FilterLink>
        </>
      );
    case "price":
      return <SalesPriceSlider state={state} />;
    case "department":
      return (
        <>
          <FilterLink
            href={calendarSalesHrefFromState(state, { categoryId: undefined, page: undefined })}
            active={!state.categoryId}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            All departments
          </FilterLink>
          {categories.map((c) => (
            <FilterLink
              key={c.id}
              href={calendarSalesHrefFromState(state, { categoryId: c.id, page: undefined })}
              active={state.categoryId === c.id}
              {...(onLinkClick ? { onLinkClick } : {})}
            >
              {c.name}
            </FilterLink>
          ))}
        </>
      );
    case "month":
      return (
        <>
          <FilterLink
            href={calendarSalesHrefFromState(state, { month: undefined, page: undefined })}
            active={state.month == null}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            Any month
          </FilterLink>
          {MONTHS.map((m) => (
            <FilterLink
              key={m.n}
              href={calendarSalesHrefFromState(state, { month: m.n, page: undefined })}
              active={state.month === m.n}
              {...(onLinkClick ? { onLinkClick } : {})}
            >
              {m.label}
            </FilterLink>
          ))}
        </>
      );
    case "year":
      return (
        <>
          <FilterLink
            href={calendarSalesHrefFromState(state, { year: undefined, page: undefined })}
            active={state.year == null}
            {...(onLinkClick ? { onLinkClick } : {})}
          >
            Any year
          </FilterLink>
          {years.map((y) => (
            <FilterLink
              key={y}
              href={calendarSalesHrefFromState(state, { year: y, page: undefined })}
              active={state.year === y}
              {...(onLinkClick ? { onLinkClick } : {})}
            >
              {y}
            </FilterLink>
          ))}
        </>
      );
  }
}
