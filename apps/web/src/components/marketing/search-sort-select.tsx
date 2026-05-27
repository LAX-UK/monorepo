"use client";

import { useSearchCatalogPending } from "@/components/marketing/search-catalog-client";
import { FilterSelect } from "@/components/ui/filter-select";

export const SORT_OPTIONS = [
  { value: "endingAsc", label: "Ending soon" },
  { value: "createdDesc", label: "Newest" },
  { value: "hammerDesc", label: "Price · High to low" },
] as const;

export type SearchSortValue = (typeof SORT_OPTIONS)[number]["value"];

export function SearchSortSelect({ value: _value }: { value: SearchSortValue }) {
  return (
    <FilterSelect
      param="sort"
      defaultValue="endingAsc"
      options={[...SORT_OPTIONS]}
      resetParams={{ offset: "0" }}
      usePendingNavigation={useSearchCatalogPending}
      className="min-h-[var(--tap-target-min,44px)] h-[var(--tap-target-min,44px)] w-auto min-w-[9.5rem] max-w-[12rem] cursor-pointer border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider shadow-none focus:ring-primary"
      ariaLabel="Sort results"
    />
  );
}

export function sortLabel(value: SearchSortValue): string {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
