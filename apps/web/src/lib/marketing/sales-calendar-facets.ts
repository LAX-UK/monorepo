import type { SaleListRow } from "@/lib/data/http/sales.server";
import {
  type CalendarRowFilters,
  applyCalendarRowFilters,
} from "@/lib/marketing/sales-calendar-filter-utils";

/** What the calendar rail counts beside its options. */
export type SalesFacetCounts = {
  delivery: { online: number; onsite: number };
  location: { online: number; london: number };
  /** Sales per month number (1-12) and per year; options with no sales are absent. */
  months: Record<number, number>;
  years: Record<number, number>;
  /** Sales per department id. */
  departments: Record<string, number>;
};

export type SalesFacetFilters = CalendarRowFilters & { categoryId?: string | undefined };

type GroupKey = "delivery" | "location" | "month" | "year" | "department";

/** The filters with one group's own filter taken off, so its options show what choosing them gives. */
function withoutGroup(filters: SalesFacetFilters, group: GroupKey): SalesFacetFilters {
  const { month, year, categoryId, ...rest } = filters;
  return {
    ...rest,
    ...(group === "delivery" ? { deliveryMode: "all" as const } : {}),
    ...(group === "location" ? { location: "all" } : {}),
    ...(month != null && group !== "month" ? { month } : {}),
    ...(year != null && group !== "year" ? { year } : {}),
    ...(categoryId && group !== "department" ? { categoryId } : {}),
  };
}

function inScope(rows: SaleListRow[], filters: SalesFacetFilters): SaleListRow[] {
  const { categoryId, ...rowFilters } = filters;
  const byDepartment = categoryId
    ? rows.filter(({ sale }) => saleCategoryIds(sale).includes(categoryId))
    : rows;
  return applyCalendarRowFilters(byDepartment, rowFilters);
}

function saleCategoryIds(sale: SaleListRow["sale"]): string[] {
  if (sale.categoryIds && sale.categoryIds.length > 0) return sale.categoryIds;
  return sale.categoryId ? [sale.categoryId] : [];
}

function tally<T extends string | number>(
  rows: SaleListRow[],
  keysOf: (row: SaleListRow) => T[],
): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const row of rows) {
    for (const key of new Set(keysOf(row))) counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Counts for the rail's options from one set of sales, in one pass per group. Each group is
 * counted with every other filter applied but not its own, so an option says how many sales
 * choosing it would give.
 */
export function countSaleFacets(rows: SaleListRow[], filters: SalesFacetFilters): SalesFacetCounts {
  const delivery = inScope(rows, withoutGroup(filters, "delivery"));
  const location = inScope(rows, withoutGroup(filters, "location"));
  const months = inScope(rows, withoutGroup(filters, "month"));
  const years = inScope(rows, withoutGroup(filters, "year"));
  const departments = inScope(rows, withoutGroup(filters, "department"));
  return {
    delivery: {
      online: delivery.filter((r) => r.sale.deliveryMode === "online").length,
      onsite: delivery.filter((r) => r.sale.deliveryMode === "onsite").length,
    },
    location: {
      online: location.filter((r) => r.sale.deliveryMode === "online").length,
      london: location.filter((r) => (r.sale.locationCity ?? "").toLowerCase().includes("london"))
        .length,
    },
    months: tally(months, (r) => [new Date(r.sale.startTime).getMonth() + 1]),
    years: tally(years, (r) => [new Date(r.sale.startTime).getFullYear()]),
    departments: tally(departments, (r) => saleCategoryIds(r.sale)),
  };
}
