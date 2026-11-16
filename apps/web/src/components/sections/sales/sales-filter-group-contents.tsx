"use client";

import { SalesFilterLinkRow } from "@/components/sections/sales/sales-filter-link-row";
import { SalesPriceSlider } from "@/components/sections/sales/sales-price-slider";
import type { SalesFacetCounts } from "@/lib/marketing/sales-calendar-facets";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import type { SalesFilterSidebarGroupValue } from "@/lib/marketing/sales-filter-sidebar-catalog";

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
  /** Sales per option; null when they could not be counted. */
  facets: SalesFacetCounts | null;
  onLinkClick?: () => void;
};

const SORTS = [
  ["startAsc", "Start date (soonest first)"],
  ["createdDesc", "Newly listed"],
] as const;

/**
 * A rail option as a checkbox that is a real link, so each value is reachable without JavaScript
 * and in the server HTML: choosing it applies it, choosing it again takes it off.
 */
function FilterCheckbox({
  label,
  count,
  active,
  onHref,
  offHref,
  onClick,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onHref: string;
  offHref: string;
  onClick?: () => void;
}) {
  return (
    <SalesFilterLinkRow
      kind="checkbox"
      label={label}
      count={count}
      checked={active}
      href={active ? offHref : onHref}
      {...(onClick ? { onClick } : {})}
    />
  );
}

/** AccordionContent `className` per group (layout scroll / spacing). */
export const salesFilterAccordionContentClass: Record<SalesFilterSidebarGroupValue, string> = {
  delivery: "flex flex-col pb-3",
  location: "flex flex-col pb-3",
  sort: "flex flex-col gap-1 pb-3",
  price: "pb-3",
  department: "flex max-h-64 flex-col overflow-y-auto pb-3",
  month: "flex max-h-64 flex-col overflow-y-auto pb-3",
  year: "flex max-h-64 flex-col overflow-y-auto pb-3",
};

export function SalesFilterGroupContents({
  group,
  state,
  categories,
  years,
  facets,
  onLinkClick,
}: SalesFilterGroupContentsProps) {
  // Following any row's link also closes the sheet the rail is in.
  const link = onLinkClick ? { onClick: onLinkClick } : {};
  const clear = { page: undefined } as const;
  switch (group) {
    case "delivery":
      return (
        <>
          {(
            [
              ["online", "Online", facets?.delivery.online],
              ["onsite", "In-person", facets?.delivery.onsite],
            ] as const
          ).map(([mode, label, count]) => (
            <FilterCheckbox
              key={mode}
              label={label}
              count={count}
              active={state.deliveryMode === mode}
              onHref={calendarSalesHrefFromState(state, { deliveryMode: mode, ...clear })}
              offHref={calendarSalesHrefFromState(state, { deliveryMode: "all", ...clear })}
              {...link}
            />
          ))}
        </>
      );
    case "location":
      return (
        <>
          {(
            [
              ["online", "Online", facets?.location.online],
              ["london", "London", facets?.location.london],
            ] as const
          ).map(([place, label, count]) => (
            <FilterCheckbox
              key={place}
              label={label}
              count={count}
              active={state.location === place}
              onHref={calendarSalesHrefFromState(state, { location: place, ...clear })}
              offHref={calendarSalesHrefFromState(state, { location: "all", ...clear })}
              {...link}
            />
          ))}
        </>
      );
    case "sort":
      return (
        <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
          <legend className="sr-only">Sort by date</legend>
          {SORTS.map(([value, label]) => (
            <SalesFilterLinkRow
              key={value}
              kind="radio"
              label={label}
              checked={state.sort === value}
              href={calendarSalesHrefFromState(state, { sort: value, ...clear })}
              {...link}
            />
          ))}
        </fieldset>
      );
    case "price":
      return <SalesPriceSlider state={state} />;
    case "department":
      return (
        <>
          {categories.map((c) => (
            <FilterCheckbox
              key={c.id}
              label={c.name}
              count={facets ? (facets.departments[c.id] ?? 0) : undefined}
              active={state.categoryId === c.id}
              onHref={calendarSalesHrefFromState(state, { categoryId: c.id, ...clear })}
              offHref={calendarSalesHrefFromState(state, { categoryId: undefined, ...clear })}
              {...link}
            />
          ))}
        </>
      );
    case "month":
      return (
        <>
          {MONTHS.map((m) => (
            <FilterCheckbox
              key={m.n}
              label={m.label}
              count={facets ? (facets.months[m.n] ?? 0) : undefined}
              active={state.month === m.n}
              onHref={calendarSalesHrefFromState(state, { month: m.n, ...clear })}
              offHref={calendarSalesHrefFromState(state, { month: undefined, ...clear })}
              {...link}
            />
          ))}
        </>
      );
    case "year":
      return (
        <>
          {years.map((y) => (
            <FilterCheckbox
              key={y}
              label={String(y)}
              count={facets ? (facets.years[y] ?? 0) : undefined}
              active={state.year === y}
              onHref={calendarSalesHrefFromState(state, { year: y, ...clear })}
              offHref={calendarSalesHrefFromState(state, { year: undefined, ...clear })}
              {...link}
            />
          ))}
        </>
      );
  }
}
