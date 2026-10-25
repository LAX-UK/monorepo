"use client";

import { SlidersHorizontal } from "lucide-react";
import { STAFF_DEFAULT_PAGE_SIZE, STAFF_PAGE_SIZES } from "../lib/page-size.js";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuCheckboxItem,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuRadioGroup,
  StaffMenuRadioItem,
  StaffMenuSeparator,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import type { ColumnVisibility } from "./columns-menu.js";
import type { DataColumn, TableDensity } from "./types.js";

export type DisplayPageSize = {
  value: number;
  /** Go to the first page at the new size (lists keep it in the URL). */
  onChange: (size: number) => void;
};

/**
 * "Display": how the list is shown, in one menu so the toolbar keeps one button for it. Columns
 * to show, row density (comfortable 44px or compact 36px), rows per page (25, 50, 100) and
 * "Reset to default". Column and density choices are remembered per list in this browser; the
 * page size lives in the URL so a link reproduces the page.
 */
export function DisplayMenu<T>({
  columns,
  visibility,
  locked,
  density,
  onDensityChange,
  defaultDensity,
  pageSize,
}: {
  columns: readonly DataColumn<T>[];
  visibility: ColumnVisibility;
  /** Columns that cannot be hidden; defaults to the first column. */
  locked?: readonly string[];
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  /** The list's own density, restored by "Reset to default". */
  defaultDensity: TableDensity;
  /** Omit for lists that are not paged. */
  pageSize?: DisplayPageSize | null;
}) {
  const fixed = new Set(locked ?? (columns[0] ? [columns[0].id] : []));
  const choices = columns.filter((column) => !fixed.has(column.id) && !column.headerHidden);
  const changed =
    visibility.changed ||
    density !== defaultDensity ||
    Boolean(pageSize && pageSize.value !== STAFF_DEFAULT_PAGE_SIZE);
  const reset = () => {
    visibility.reset();
    onDensityChange(defaultDensity);
    if (pageSize && pageSize.value !== STAFF_DEFAULT_PAGE_SIZE) {
      pageSize.onChange(STAFF_DEFAULT_PAGE_SIZE);
    }
  };
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton size="sm" variant="secondary" icon={<SlidersHorizontal aria-hidden />}>
          Display
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="end" className="max-h-[min(560px,70vh)] w-60 overflow-y-auto">
        {choices.length > 0 ? (
          <>
            <StaffMenuLabel>Columns</StaffMenuLabel>
            {choices.map((column) => (
              <StaffMenuCheckboxItem
                key={column.id}
                checked={!visibility.hidden.has(column.id)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => visibility.setHidden(column.id, !checked)}
              >
                {column.header}
              </StaffMenuCheckboxItem>
            ))}
            <StaffMenuSeparator />
          </>
        ) : null}
        <StaffMenuLabel>Rows</StaffMenuLabel>
        <StaffMenuRadioGroup
          value={density}
          onValueChange={(value) => onDensityChange(value as TableDensity)}
        >
          <StaffMenuRadioItem value="comfortable" onSelect={(event) => event.preventDefault()}>
            Comfortable
          </StaffMenuRadioItem>
          <StaffMenuRadioItem value="compact" onSelect={(event) => event.preventDefault()}>
            Compact
          </StaffMenuRadioItem>
        </StaffMenuRadioGroup>
        {pageSize ? (
          <>
            <StaffMenuSeparator />
            <StaffMenuLabel>Rows per page</StaffMenuLabel>
            <StaffMenuRadioGroup
              value={String(pageSize.value)}
              onValueChange={(value) => pageSize.onChange(Number(value))}
            >
              {STAFF_PAGE_SIZES.map((size) => (
                <StaffMenuRadioItem key={size} value={String(size)}>
                  <span className="tabular-nums">{size}</span>
                </StaffMenuRadioItem>
              ))}
            </StaffMenuRadioGroup>
          </>
        ) : null}
        <StaffMenuSeparator />
        <StaffMenuItem disabled={!changed} onSelect={reset}>
          Reset to default
        </StaffMenuItem>
      </StaffMenuContent>
    </StaffMenu>
  );
}
