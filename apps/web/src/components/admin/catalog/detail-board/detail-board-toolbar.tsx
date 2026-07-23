"use client";

import type { DetailBoardFilter } from "@/lib/admin/detail-board/types";
import { cn } from "@auction/ui";
import { FilterChipGroup } from "@auction/ui/components/filter-chip-group";
import { Input } from "@auction/ui/components/input";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

type DetailBoardToolbarBaseProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  trailing?: ReactNode;
  className?: string;
};

type DetailBoardToolbarFilterProps<TFilter extends string> =
  | {
      filters: readonly DetailBoardFilter<TFilter>[];
      activeFilter: TFilter;
      onFilterChange: (id: TFilter) => void;
      filterAriaLabel?: string;
    }
  | {
      filters?: never;
      activeFilter?: never;
      onFilterChange?: never;
      filterAriaLabel?: never;
    };

export type DetailBoardToolbarProps<TFilter extends string = string> = DetailBoardToolbarBaseProps &
  DetailBoardToolbarFilterProps<TFilter>;

/** Search + filter chips row for detail tab boards. */
export function DetailBoardToolbar<TFilter extends string = string>({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  activeFilter,
  onFilterChange,
  filterAriaLabel = "Filter",
  trailing,
  className,
}: DetailBoardToolbarProps<TFilter>) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4", className)}>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 rounded-full border-shell-stroke bg-shell-search-bg pl-9"
          aria-label={searchPlaceholder}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[50%]">
        {filters && filters.length > 0 ? (
          <FilterChipGroup
            items={filters.map((f) => ({ id: f.id, label: f.label }))}
            value={activeFilter}
            onChange={onFilterChange}
            aria-label={filterAriaLabel}
          />
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
