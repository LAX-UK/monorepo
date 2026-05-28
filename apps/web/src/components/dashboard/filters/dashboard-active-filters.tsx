"use client";

import { FilterRowNav } from "@/components/dashboard/filter-row-nav";
import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import type { ActiveFilterDescriptor } from "@/lib/dashboard/filters/types";

export type DashboardActiveFiltersProps = {
  filters: readonly ActiveFilterDescriptor[];
  clearAllHref?: string;
  /** Override link label (default: "Clear all"). */
  clearAllLabel?: string;
  className?: string;
};

/** Dismissible active-filter pill row with optional clear-all link. */
export function DashboardActiveFilters({
  filters,
  clearAllHref,
  className,
}: DashboardActiveFiltersProps) {
  const chips = filters.map((filter) => ({
    key: filter.id,
    label: filter.label,
    removeHref: filter.href,
  }));

  return (
    <CatalogActiveFilterChips
      chips={chips}
      {...(clearAllHref ? { clearHref: clearAllHref } : {})}
      {...(className ? { className } : {})}
    />
  );
}

export type DashboardFilterChipRowProps = {
  label: string;
  items: Parameters<typeof FilterRowNav>[0]["items"];
  className?: string;
};

/** Inline primary filter chip row. */
export function DashboardFilterChipRow({ label, items, className }: DashboardFilterChipRowProps) {
  return (
    <FilterRowNav
      label={label}
      items={items}
      {...(className ? { className } : {})}
      scroll={false}
    />
  );
}
