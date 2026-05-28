"use client";

import { FilterRowNav } from "@/components/dashboard/filter-row-nav";
import type { ActiveFilterDescriptor } from "@/lib/dashboard/filters/types";
import { cn } from "@auction/ui";
import Link from "next/link";

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
  clearAllLabel = "Clear all",
  className,
}: DashboardActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div
      className={cn(
        "relative -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto scroll-smooth px-1 pb-0.5 snap-x snap-mandatory [mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]",
        className,
      )}
      aria-label="Active filters"
    >
      {filters.map((filter) => (
        <Link
          key={filter.id}
          href={filter.href}
          scroll={false}
          className="inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border border-primary/35 bg-primary-container/45 px-3 font-label text-xs font-medium text-primary shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span>{filter.label}</span>
          <span aria-hidden className="text-sm leading-none">
            ×
          </span>
          <span className="sr-only">Remove {filter.label} filter</span>
        </Link>
      ))}
      {clearAllHref ? (
        <Link
          href={clearAllHref}
          scroll={false}
          className="shrink-0 px-2 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {clearAllLabel}
        </Link>
      ) : null}
    </div>
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
