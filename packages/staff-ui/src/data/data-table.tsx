"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Skeleton } from "../display/states.js";
import { cn } from "../lib/cn.js";
import { StaffCheckbox } from "../primitives/choice.js";
import { BulkActionBar } from "./bulk-action-bar.js";
import type { DataColumn, SortState, TableDensity } from "./types.js";

export type DataTableProps<T> = {
  /** Accessible name, e.g. "Orders". */
  label: string;
  columns: readonly DataColumn<T>[];
  data: readonly T[];
  getRowId: (row: T) => string;
  /** Enter, or a click on the row outside its links and buttons, opens the row (e.g. a panel). */
  onRowOpen?: (row: T) => void;
  /** The row shown in an open panel, marked so it is easy to find again. */
  activeRowId?: string | null;
  density?: TableDensity;
  /** Controlled sort, for lists sorted by the server. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Selection: pass both to enable checkboxes and the bulk-action bar. */
  selectedIds?: ReadonlySet<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  /** Actions for the selected rows, shown in the bulk-action bar. */
  bulkActions?: (selected: T[]) => React.ReactNode;
  bulkNoun?: { one: string; other: string };
  /** First load: skeleton rows of the final height, so nothing shifts when data arrives. */
  loading?: boolean;
  /** Replaces the rows when loading failed: an ErrorState with a retry. */
  error?: React.ReactNode;
  /** Shown when there are no rows: EmptyState, or NoResultsState when filtered. */
  empty?: React.ReactNode;
  /** Search, filters and views, inside the card above the table. */
  toolbar?: React.ReactNode;
  /** Pagination, inside the card below the table. */
  footer?: React.ReactNode;
  className?: string;
};

const INTERACTIVE = "a,button,input,select,textarea,label,[role=checkbox],[role=menuitem]";

const hideBelowClass = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function ariaSort(column: { id: string }, sort: SortState | null) {
  if (!sort || sort.columnId !== column.id) return "none" as const;
  return sort.direction === "asc" ? ("ascending" as const) : ("descending" as const);
}

/**
 * The staff data table. Typed columns, sorting, selection with a bulk-action bar, row focus and
 * keyboard navigation (arrows move, Enter opens, Space selects, Escape clears), and loading, empty
 * and error states that keep the card's geometry. Below 768px rows become a stacked list.
 */
export function DataTable<T>({
  label,
  columns,
  data,
  getRowId,
  onRowOpen,
  activeRowId = null,
  density = "comfortable",
  sort: controlledSort,
  onSortChange,
  selectedIds,
  onSelectedIdsChange,
  bulkActions,
  bulkNoun,
  loading = false,
  error,
  empty,
  toolbar,
  footer,
  className,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = React.useState<SortState | null>(null);
  const sort = onSortChange ? (controlledSort ?? null) : localSort;
  const selectable = Boolean(selectedIds && onSelectedIdsChange);
  const interactiveRows = Boolean(onRowOpen) || selectable;
  const [focusIndex, setFocusIndex] = React.useState(0);
  const rowRefs = React.useRef<Array<HTMLTableRowElement | null>>([]);

  const rows = React.useMemo(() => {
    if (onSortChange || !sort) return data;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return data;
    const value = column.sortValue;
    const sorted = [...data].sort((a, b) => compareValues(value(a), value(b)));
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }, [data, columns, sort, onSortChange]);

  const ids = React.useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const selectedCount = selectable ? ids.filter((id) => selectedIds?.has(id)).length : 0;
  const allSelected = selectedCount > 0 && selectedCount === ids.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleSort = (column: DataColumn<T>) => {
    const next: SortState | null =
      sort?.columnId !== column.id
        ? { columnId: column.id, direction: "asc" }
        : sort.direction === "asc"
          ? { columnId: column.id, direction: "desc" }
          : null;
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  const setSelected = (next: Set<string>) => onSelectedIdsChange?.(next);
  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setFocusIndex(clamped);
    rowRefs.current[clamped]?.focus();
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
    if (event.target !== event.currentTarget) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows.length - 1);
        break;
      case "Enter":
        if (onRowOpen) {
          event.preventDefault();
          onRowOpen(row);
        }
        break;
      case " ":
        if (selectable) {
          event.preventDefault();
          toggleRow(getRowId(row));
        }
        break;
      case "Escape":
        if (selectable && selectedCount > 0) {
          event.preventDefault();
          setSelected(new Set());
        }
        break;
    }
  };

  const onRowClick = (event: React.MouseEvent, index: number, row: T) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    setFocusIndex(index);
    onRowOpen?.(row);
  };

  const rowHeight = density === "compact" ? "h-9" : "h-11";
  const showSkeleton = loading && rows.length === 0;
  const showEmpty = !loading && !error && rows.length === 0;
  const selectedRows = selectable ? rows.filter((row) => selectedIds?.has(getRowId(row))) : [];
  const titleColumn = columns.find((c) => c.mobile === "title") ?? columns[0];
  const badgeColumns = columns.filter((c) => c.mobile === "badge");
  const metaColumns = columns.filter((c) => c.mobile === "meta");

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-staff-md border border-staff-line bg-staff-surface">
        {toolbar ? <div className="border-b border-staff-line">{toolbar}</div> : null}

        {error ? (
          error
        ) : showEmpty ? (
          empty
        ) : (
          <>
            {/* Table layout, from 768px. */}
            <div className="hidden overflow-x-auto md:block">
              <table
                aria-label={label}
                {...(interactiveRows ? { role: "grid" } : {})}
                {...(selectable ? { "aria-multiselectable": true } : {})}
                aria-busy={loading || undefined}
                aria-rowcount={rows.length + 1}
                className="w-full table-fixed border-collapse text-staff-sm"
              >
                <thead>
                  <tr className="h-9 border-b border-staff-line">
                    {selectable ? (
                      <th
                        scope="col"
                        style={{ width: "44px" }}
                        className="pl-4 text-left [&>button]:flex"
                      >
                        <StaffCheckbox
                          aria-label={
                            allSelected ? "Clear selection" : "Select all rows on this page"
                          }
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          disabled={rows.length === 0}
                          onCheckedChange={() =>
                            setSelected(allSelected ? new Set() : new Set(ids))
                          }
                        />
                      </th>
                    ) : null}
                    {columns.map((column, index) => (
                      <th
                        key={column.id}
                        scope="col"
                        aria-sort={column.sortable ? ariaSort(column, sort) : undefined}
                        {...(column.width ? { style: { width: column.width } } : {})}
                        className={cn(
                          "px-3 text-staff-xs font-medium whitespace-nowrap text-staff-muted",
                          column.numeric ? "text-right" : "text-left",
                          index === 0 && !selectable && "pl-4",
                          index === columns.length - 1 && "pr-4",
                          column.hideBelow && hideBelowClass[column.hideBelow],
                        )}
                      >
                        {column.sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className={cn(
                              "staff-focus group/sort -mx-1.5 inline-flex h-control-xs items-center gap-1 rounded-staff-xs px-1.5 transition-colors hover:bg-staff-hover hover:text-staff-fg",
                              column.numeric && "flex-row-reverse",
                              sort?.columnId === column.id && "text-staff-fg",
                            )}
                          >
                            {column.header}
                            {sort?.columnId === column.id ? (
                              sort.direction === "asc" ? (
                                <ArrowUp aria-hidden className="size-3.5" />
                              ) : (
                                <ArrowDown aria-hidden className="size-3.5" />
                              )
                            ) : (
                              <ChevronsUpDown
                                aria-hidden
                                className="size-3.5 opacity-0 transition-opacity group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
                              />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  className={cn(loading && rows.length > 0 && "opacity-60 transition-opacity")}
                >
                  {showSkeleton
                    ? Array.from({ length: 8 }, (_, rowIndex) => (
                        <tr
                          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
                          key={rowIndex}
                          aria-hidden
                          className={cn(
                            rowHeight,
                            "border-b border-staff-line-subtle last:border-b-0",
                          )}
                        >
                          {selectable ? (
                            <td className="pl-4">
                              <Skeleton className="size-4" />
                            </td>
                          ) : null}
                          {columns.map((column, index) => (
                            <td
                              key={column.id}
                              className={cn(
                                "px-3",
                                index === 0 && !selectable && "pl-4",
                                column.hideBelow && hideBelowClass[column.hideBelow],
                              )}
                            >
                              <Skeleton
                                className={cn(
                                  "h-3",
                                  column.numeric ? "ml-auto w-14" : index === 0 ? "w-3/4" : "w-1/2",
                                )}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    : rows.map((row, index) => {
                        const id = getRowId(row);
                        const selected = selectable && Boolean(selectedIds?.has(id));
                        const active = activeRowId === id;
                        return (
                          <tr
                            key={id}
                            ref={(element) => {
                              rowRefs.current[index] = element;
                            }}
                            aria-rowindex={index + 2}
                            {...(selectable ? { "aria-selected": selected } : {})}
                            {...(interactiveRows
                              ? {
                                  tabIndex: index === focusIndex ? 0 : -1,
                                  onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) =>
                                    onRowKeyDown(event, index, row),
                                  onFocus: (event: React.FocusEvent<HTMLTableRowElement>) => {
                                    if (event.target === event.currentTarget) setFocusIndex(index);
                                  },
                                }
                              : {})}
                            onClick={(event) => onRowClick(event, index, row)}
                            data-state={selected ? "selected" : undefined}
                            data-active={active || undefined}
                            className={cn(
                              rowHeight,
                              "staff-focus-inset border-b border-staff-line-subtle transition-colors duration-100 last:border-b-0",
                              onRowOpen && "cursor-pointer",
                              "hover:staff-overlay-hover",
                              selected && "staff-overlay-selected hover:staff-overlay-selected",
                              active &&
                                "staff-overlay-selected shadow-[inset_2px_0_0_var(--color-staff-ink)]",
                            )}
                          >
                            {selectable ? (
                              <td className="pl-4 [&>button]:flex">
                                <StaffCheckbox
                                  aria-label={`Select row ${index + 1}`}
                                  checked={selected}
                                  onCheckedChange={() => toggleRow(id)}
                                  tabIndex={-1}
                                />
                              </td>
                            ) : null}
                            {columns.map((column, columnIndex) => (
                              <td
                                key={column.id}
                                className={cn(
                                  "truncate px-3 text-staff-fg",
                                  column.numeric && "text-right tabular-nums",
                                  columnIndex === 0 && !selectable && "pl-4",
                                  columnIndex === columns.length - 1 && "pr-4",
                                  column.hideBelow && hideBelowClass[column.hideBelow],
                                )}
                              >
                                {column.cell(row)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Stacked list, below 768px. */}
            <ul
              aria-label={label}
              aria-busy={loading || undefined}
              className="divide-y divide-staff-line-subtle md:hidden"
            >
              {showSkeleton
                ? Array.from({ length: 6 }, (_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
                    <li key={index} aria-hidden className="flex flex-col gap-2 px-4 py-3">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </li>
                  ))
                : rows.map((row, index) => {
                    const id = getRowId(row);
                    const selected = selectable && Boolean(selectedIds?.has(id));
                    return (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users open the row through its title link
                      <li
                        key={id}
                        onClick={(event) => onRowClick(event, index, row)}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition-colors",
                          onRowOpen && "cursor-pointer active:staff-overlay-pressed",
                          (selected || activeRowId === id) && "staff-overlay-selected",
                        )}
                      >
                        {selectable ? (
                          <span className="flex h-5 items-center">
                            <StaffCheckbox
                              aria-label={`Select row ${index + 1}`}
                              checked={selected}
                              onCheckedChange={() => toggleRow(id)}
                            />
                          </span>
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 truncate text-staff-sm font-medium text-staff-fg">
                              {titleColumn ? titleColumn.cell(row) : null}
                            </div>
                            {badgeColumns.length > 0 ? (
                              <div className="flex shrink-0 items-center gap-1.5">
                                {badgeColumns.map((column) => (
                                  <React.Fragment key={column.id}>
                                    {column.cell(row)}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {metaColumns.length > 0 ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-staff-xs text-staff-muted">
                              {metaColumns.map((column) => (
                                <span
                                  key={column.id}
                                  className={cn(
                                    "min-w-0 truncate",
                                    column.numeric && "tabular-nums text-staff-fg",
                                  )}
                                >
                                  {column.cell(row)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
            </ul>
          </>
        )}

        {footer ? <div className="border-t border-staff-line">{footer}</div> : null}
      </div>

      {selectable && bulkActions ? (
        <BulkActionBar
          count={selectedRows.length}
          onClear={() => setSelected(new Set())}
          {...(bulkNoun ? { noun: bulkNoun } : {})}
        >
          {bulkActions(selectedRows)}
        </BulkActionBar>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {selectedCount > 0 ? `${selectedCount} selected` : ""}
      </p>
    </div>
  );
}
