"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { FilterChip } from "./filter-chip.js";

export type FilterChipGroupItem<TId extends string = string> = {
  id: TId;
  label: React.ReactNode;
  disabled?: boolean;
};

export type FilterChipGroupProps<TId extends string = string> = {
  items: readonly FilterChipGroupItem<TId>[];
  value: TId;
  onChange: (id: TId) => void;
  "aria-label": string;
  className?: string;
};

/** Horizontal filter chip row for detail boards and list toolbars. */
export function FilterChipGroup<TId extends string = string>({
  items,
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
}: FilterChipGroupProps<TId>) {
  return (
    <fieldset
      aria-label={ariaLabel}
      className={cn("m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0", className)}
    >
      {items.map((item) => (
        <FilterChip
          key={item.id}
          pressed={item.id === value}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </FilterChip>
      ))}
    </fieldset>
  );
}
