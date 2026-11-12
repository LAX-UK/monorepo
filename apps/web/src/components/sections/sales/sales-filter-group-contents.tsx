"use client";

import { SalesPriceSlider } from "@/components/sections/sales/sales-price-slider";
import type { SalesFacetCounts } from "@/lib/marketing/sales-calendar-facets";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { calendarSalesHrefFromState } from "@/lib/marketing/sales-calendar-params";
import type { SalesFilterSidebarGroupValue } from "@/lib/marketing/sales-filter-sidebar-catalog";
import { MarketingFilterCheckboxRow } from "@auction/marketing-ui/marketing-filter-checkbox-row";
import { MarketingFilterRadioRow } from "@auction/marketing-ui/marketing-filter-radio-row";
import { RadioGroup } from "@auction/ui/components/radio-group";
import { useRouter } from "next/navigation";

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

/** A rail option as a checkbox: choosing it applies it, choosing it again takes it off. */
function FilterCheckbox({
  id,
  label,
  count,
  active,
  onHref,
  offHref,
  onLinkClick,
}: {
  id: string;
  label: string;
  count: number | undefined;
  active: boolean;
  onHref: string;
  offHref: string;
  onLinkClick?: () => void;
}) {
  const router = useRouter();
  return (
    <MarketingFilterCheckboxRow
      id={id}
      label={label}
      count={count}
      checked={active}
      dense
      onCheckedChange={() => {
        router.push(active ? offHref : onHref, { scroll: false });
        onLinkClick?.();
      }}
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
  const router = useRouter();
  const link = onLinkClick ? { onLinkClick } : {};
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
              id={`sales-delivery-${mode}`}
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
              id={`sales-location-${place}`}
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
        <RadioGroup
          aria-label="Sort by date"
          value={state.sort}
          onValueChange={(sort) => {
            router.push(
              calendarSalesHrefFromState(state, { sort: sort as typeof state.sort, ...clear }),
              { scroll: false },
            );
            onLinkClick?.();
          }}
          className="gap-0"
        >
          {SORTS.map(([value, label]) => (
            <MarketingFilterRadioRow
              key={value}
              id={`sales-sort-${value}`}
              value={value}
              label={label}
              checked={state.sort === value}
              dense
            />
          ))}
        </RadioGroup>
      );
    case "price":
      return <SalesPriceSlider state={state} />;
    case "department":
      return (
        <>
          {categories.map((c) => (
            <FilterCheckbox
              key={c.id}
              id={`sales-department-${c.id}`}
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
              id={`sales-month-${m.n}`}
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
              id={`sales-year-${y}`}
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
