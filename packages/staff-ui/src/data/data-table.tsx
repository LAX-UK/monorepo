"use client";

import { TooltipProvider } from "@auction/ui/components/tooltip";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Skeleton } from "../display/states.js";
import { STAFF_TRUNCATION_TOOLTIP_DELAY_MS, TruncatedText } from "../display/truncated-text.js";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import { StaffCheckbox } from "../primitives/choice.js";
import { useStaffShortcut } from "../shell/shortcuts.js";
import { BulkActionBar, TableSelectionProvider } from "./bulk-action-bar.js";
import { EmptyValue, isEmptyCellValue } from "./cells.js";
import type {
  BulkSelectionScope,
  DataColumn,
  SelectAllMatching,
  SortState,
  TableDensity,
} from "./types.js";

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
  /**
   * The list's order when nothing else is chosen, e.g. newest first. A list always shows one
   * sorted column; clicking it toggles the direction and never clears the sort.
   */
  defaultSort?: SortState;
  /** Controlled sort, for lists sorted by the server. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** Selection: pass both to enable checkboxes and the bulk-action bar. */
  selectedIds?: ReadonlySet<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  /**
   * Offers "Select all N matching" once every row on the page is selected, for lists with more
   * matching rows than one page shows.
   */
  selectAllMatching?: SelectAllMatching;
  /** Actions for the selected rows, shown in the bulk-action bar. */
  bulkActions?: (selected: T[], scope: BulkSelectionScope) => React.ReactNode;
  bulkNoun?: { one: string; other: string };
  /**
   * Keeps the column headers in view under the top bar while the page scrolls (default). When
   * the columns are wider than the card, the table scrolls sideways instead and the header
   * scrolls with the page.
   */
  stickyHeader?: boolean;
  /** Keeps the identifying column in view while a wide table scrolls sideways. */
  stickyFirstColumn?: boolean;
  /** First load: skeleton rows of the final height, so nothing shifts when data arrives. */
  loading?: boolean;
  /** Replaces the rows when loading failed: an ErrorState with a retry. */
  error?: React.ReactNode;
  /** Shown when there are no rows: EmptyState, or NoResultsState when filtered. */
  empty?: React.ReactNode;
  /** Search, filters and views, inside the card above the table. */
  toolbar?: React.ReactNode;
  /**
   * Keeps the toolbar in view under the top bar while the page scrolls, with the column headers
   * sticking under it (default, from 768px).
   */
  stickyToolbar?: boolean;
  /** Pagination, inside the card below the table. */
  footer?: React.ReactNode;
  /**
   * The table sits inside a `Section` (a record's related rows) and the section is the card:
   * the table draws no border or rounded corners of its own.
   */
  embedded?: boolean;
  className?: string;
};

const INTERACTIVE = "a,button,input,select,textarea,label,[role=checkbox],[role=menuitem]";
const SELECT_CELL = "[data-staff-select-cell]";
const COUNT = new Intl.NumberFormat("en-GB");

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

function truncationOf<T>(column: DataColumn<T>) {
  return column.truncate ?? (column.numeric ? false : "end");
}

/** The element's height, kept current; 0 when off or not measurable. */
function useElementHeight(ref: React.RefObject<HTMLElement | null>, on: boolean) {
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!on || !element) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(Math.round(element.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, on]);
  return height;
}

/** True when the table is wider than its card and has to scroll sideways. */
function useHorizontalOverflow(
  wrapper: React.RefObject<HTMLDivElement | null>,
  table: React.RefObject<HTMLTableElement | null>,
) {
  const [overflowing, setOverflowing] = React.useState(false);
  React.useLayoutEffect(() => {
    const box = wrapper.current;
    const inner = table.current;
    if (!box || !inner) return;
    const measure = () => setOverflowing(inner.scrollWidth > box.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [wrapper, table]);
  return overflowing;
}

/**
 * The staff data table. Typed columns, sorting, selection with a bulk-action bar, row focus and
 * keyboard navigation (arrows or J and K move, Enter opens, Space or X selects, Shift extends the
 * selection, Escape clears), a sticky header, and loading, empty and error states that keep the
 * card's geometry. Below 768px rows become a stacked list.
 */
export function DataTable<T>({
  label,
  columns,
  data,
  getRowId,
  onRowOpen,
  activeRowId = null,
  density = "comfortable",
  defaultSort,
  sort: controlledSort,
  onSortChange,
  selectedIds,
  onSelectedIdsChange,
  selectAllMatching,
  bulkActions,
  bulkNoun,
  stickyHeader = true,
  stickyFirstColumn = false,
  loading = false,
  error,
  empty,
  toolbar,
  stickyToolbar = true,
  footer,
  embedded = false,
  className,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = React.useState<SortState | null>(defaultSort ?? null);
  const sort = onSortChange ? (controlledSort ?? defaultSort ?? null) : localSort;
  const selectable = Boolean(selectedIds && onSelectedIdsChange);
  const interactiveRows = Boolean(onRowOpen) || selectable;
  const [focusIndex, setFocusIndex] = React.useState(0);
  const rowRefs = React.useRef<Array<HTMLTableRowElement | null>>([]);
  const anchorIndex = React.useRef<number | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const overflowing = useHorizontalOverflow(wrapperRef, tableRef);
  const headerSticks = stickyHeader && !overflowing;
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const toolbarHeight = useElementHeight(toolbarRef, Boolean(toolbar && stickyToolbar));
  // The page's scroll padding reads it too, so a row moved to by keyboard stops below the toolbar.
  React.useEffect(() => {
    if (toolbarHeight === 0) return;
    const root = document.documentElement;
    root.style.setProperty("--staff-table-toolbar-height", `${toolbarHeight}px`);
    return () => {
      root.style.removeProperty("--staff-table-toolbar-height");
    };
  }, [toolbarHeight]);
  const firstColumnSticks = stickyFirstColumn && overflowing;

  const rows = React.useMemo(() => {
    if (onSortChange || !sort) return data;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return data;
    const value = column.sortValue;
    // Ties keep the server's order in both directions; empty values always sort last.
    const sign = sort.direction === "desc" ? -1 : 1;
    return [...data].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x === null || y === null) return compareValues(x, y);
      return sign * compareValues(x, y);
    });
  }, [data, columns, sort, onSortChange]);

  const ids = React.useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const allMatching = selectable && Boolean(selectAllMatching?.active);
  const isSelected = (id: string) => allMatching || Boolean(selectedIds?.has(id));
  const pageSelectedCount = selectable ? ids.filter(isSelected).length : 0;
  const allSelected = pageSelectedCount > 0 && pageSelectedCount === ids.length;
  const someSelected = pageSelectedCount > 0 && !allSelected;
  const selectedCount = allMatching ? (selectAllMatching?.total ?? 0) : pageSelectedCount;

  const toggleSort = (column: DataColumn<T>) => {
    const next: SortState =
      sort?.columnId === column.id
        ? { columnId: column.id, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { columnId: column.id, direction: column.defaultSortDirection ?? "asc" };
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  const setSelected = (next: Set<string>) => {
    if (allMatching) selectAllMatching?.onActiveChange(false);
    onSelectedIdsChange?.(next);
  };
  const clearSelection = () => {
    anchorIndex.current = null;
    setSelected(new Set());
  };

  /** Toggles one row, or with `extend` sets every row from the last one toggled to this one. */
  const toggleRow = (index: number, extend = false) => {
    const id = ids[index];
    if (id === undefined) return;
    const current = new Set(allMatching ? ids : selectedIds);
    const on = !current.has(id);
    const from = extend && anchorIndex.current !== null ? anchorIndex.current : index;
    const [start, end] = from < index ? [from, index] : [index, from];
    for (let i = start; i <= end; i += 1) {
      const rowId = ids[i];
      if (rowId === undefined) continue;
      if (on) current.add(rowId);
      else current.delete(rowId);
    }
    if (!extend) anchorIndex.current = index;
    setSelected(current);
  };

  const toggleAll = () => {
    anchorIndex.current = null;
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setFocusIndex(clamped);
    const row = rowRefs.current[clamped];
    row?.focus();
    // Respects the page's scroll padding, so the row stops clear of the header and bulk bar.
    row?.scrollIntoView?.({ block: "nearest" });
  };

  // J and K from anywhere on the page land on the table's current row; once a row has focus the
  // row's own keys move on from there. Only in the table layout, where rows take focus.
  const enterRows = () => {
    if (!wrapperRef.current || wrapperRef.current.offsetParent === null) return;
    const focused = rowRefs.current.findIndex((row) => row === document.activeElement);
    focusRow(focused >= 0 ? focused : focusIndex);
  };
  const keyboardRows = interactiveRows && rows.length > 0 && !loading;
  useStaffShortcut(
    keyboardRows
      ? {
          id: "staff:list-next-row",
          keys: "j",
          label: "Next row",
          group: "Lists",
          handler: enterRows,
        }
      : null,
  );
  useStaffShortcut(
    keyboardRows
      ? {
          id: "staff:list-previous-row",
          keys: "k",
          label: "Previous row",
          group: "Lists",
          handler: enterRows,
        }
      : null,
  );
  useStaffShortcut(
    keyboardRows && onRowOpen
      ? {
          id: "staff:list-open-row",
          keys: "enter",
          label: "Open the focused row",
          group: "Lists",
          passive: true,
          handler: () => {},
        }
      : null,
  );
  useStaffShortcut(
    keyboardRows && onRowOpen
      ? {
          id: "staff:list-close-panel",
          keys: "escape",
          label: "Close the open panel or menu",
          group: "Lists",
          passive: true,
          handler: () => {},
        }
      : null,
  );

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
    if (event.target !== event.currentTarget) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case "ArrowDown":
      case "j":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
      case "k":
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
      case "x":
      case "X":
        if (selectable) {
          event.preventDefault();
          toggleRow(index, event.shiftKey);
        }
        break;
      case "Escape":
        if (selectable && selectedCount > 0) {
          event.preventDefault();
          clearSelection();
        }
        break;
    }
  };

  const onRowClick = (event: React.MouseEvent, index: number, row: T) => {
    const target = event.target as HTMLElement;
    if (target.closest(SELECT_CELL) || target.closest(INTERACTIVE)) return;
    setFocusIndex(index);
    onRowOpen?.(row);
  };

  /** The whole selection cell is the hit target: a near miss selects, it never opens the row. */
  const selectCellProps = (index: number) => ({
    "data-staff-select-cell": "",
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      setFocusIndex(index);
      toggleRow(index, event.shiftKey);
    },
    // Shift+click would otherwise select the text between the two rows.
    onMouseDown: (event: React.MouseEvent) => {
      if (event.shiftKey) event.preventDefault();
    },
  });

  // The checkbox only shows the state; its cell handles the click (a pointer click, or Space on
  // the focused checkbox, which the browser turns into a click), so one press toggles once.
  const passClickToCell = (event: React.MouseEvent) => event.preventDefault();

  const rowHeight = density === "compact" ? "h-9" : "h-11";
  const showSkeleton = loading && rows.length === 0;
  const showEmpty = !loading && !error && rows.length === 0;
  const selectedRows = selectable ? rows.filter((row) => isSelected(getRowId(row))) : [];
  const titleColumn = columns.find((c) => c.mobile === "title") ?? columns[0];
  const badgeColumns = columns.filter((c) => c.mobile === "badge");
  const metaColumns = columns.filter((c) => c.mobile === "meta");
  const actionColumns = columns.filter((c) => c.mobile === "actions");
  const noun = bulkNoun ?? { one: "row", other: "rows" };
  const canSelectMatching =
    selectAllMatching && !allMatching && allSelected && selectAllMatching.total > rows.length;

  // Under the top bar, and under the toolbar when that sticks too.
  const stickyHeadCell = headerSticks
    ? "sticky top-[calc(var(--staff-sticky-top,0px)+var(--staff-table-toolbar-height,0px))] z-10 bg-staff-surface shadow-[inset_0_-1px_0_var(--color-staff-line)]"
    : "";
  // Sticky cells need an opaque fill; they inherit the row's hover and selected overlays.
  const stickyBodyCell = "sticky z-[1] bg-staff-surface [background-image:inherit]";
  const stickyEdge = "shadow-[inset_-1px_0_0_var(--color-staff-line)]";
  const firstSticky = (offset: "left-0" | "left-11") =>
    firstColumnSticks ? cn(stickyBodyCell, offset, stickyEdge) : "";
  const selectSticky = firstColumnSticks ? cn(stickyBodyCell, "left-0") : "";

  let scopeAction: React.ReactNode = null;
  if (selectAllMatching && allMatching) {
    scopeAction = (
      <StaffButton
        variant="ghost"
        size="sm"
        onClick={() => selectAllMatching.onActiveChange(false)}
        className="text-staff-muted"
      >
        Select this page only
      </StaffButton>
    );
  } else if (canSelectMatching) {
    scopeAction = (
      <StaffButton
        variant="ghost"
        size="sm"
        onClick={() => selectAllMatching.onActiveChange(true)}
        className="underline-offset-2 hover:underline"
      >
        Select all {COUNT.format(selectAllMatching.total)} matching
      </StaffButton>
    );
  } else if (!allSelected) {
    // The header checkbox is not shown in the stacked list, so the bar offers it there.
    scopeAction = (
      <StaffButton variant="ghost" size="sm" onClick={toggleAll} className="md:hidden">
        Select all
      </StaffButton>
    );
  }

  return (
    <TableSelectionProvider value={selectable && selectedCount > 0}>
      <TooltipProvider delayDuration={STAFF_TRUNCATION_TOOLTIP_DELAY_MS}>
        <div className={cn("relative", className)}>
          {/* Clips the rounded corners without becoming a scroll container, so headers can stick. */}
          <div
            className={cn(
              "overflow-clip bg-staff-surface",
              !embedded && "rounded-staff-lg border border-staff-line",
            )}
          >
            {toolbar ? (
              <div
                ref={toolbarRef}
                {...(stickyToolbar ? { "data-staff-sticky-toolbar": "" } : {})}
                className={cn(
                  "border-b border-staff-line bg-staff-surface",
                  stickyToolbar && "md:sticky md:top-[var(--staff-sticky-top,0px)] md:z-20",
                )}
              >
                {toolbar}
              </div>
            ) : null}

            {error ? (
              error
            ) : showEmpty ? (
              empty
            ) : (
              <>
                {/* Table layout, from 768px. */}
                <div
                  ref={wrapperRef}
                  {...(headerSticks ? { "data-staff-sticky-header": "" } : {})}
                  className={cn(
                    "hidden md:block",
                    overflowing ? "overflow-x-auto" : "overflow-x-clip",
                  )}
                >
                  <table
                    ref={tableRef}
                    aria-label={label}
                    {...(interactiveRows ? { role: "grid" } : {})}
                    {...(selectable ? { "aria-multiselectable": true } : {})}
                    aria-busy={loading || undefined}
                    aria-rowcount={rows.length + 1}
                    className="w-full table-fixed border-collapse text-staff-sm"
                  >
                    <thead>
                      <tr className={cn("h-9", !headerSticks && "border-b border-staff-line")}>
                        {selectable ? (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: the checkbox inside is the keyboard route; the cell only widens the pointer target
                          <th
                            scope="col"
                            style={{ width: "44px" }}
                            data-staff-select-cell=""
                            onClick={() => {
                              if (rows.length > 0) toggleAll();
                            }}
                            className={cn(
                              "cursor-pointer pl-4 text-left [&>button]:flex",
                              stickyHeadCell,
                              firstColumnSticks && "sticky left-0 z-20 bg-staff-surface",
                            )}
                          >
                            <StaffCheckbox
                              aria-label={
                                allSelected ? "Clear selection" : "Select all rows on this page"
                              }
                              checked={allSelected ? true : someSelected ? "indeterminate" : false}
                              disabled={rows.length === 0}
                              onClick={passClickToCell}
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
                              stickyHeadCell,
                              index === 0 &&
                                firstColumnSticks &&
                                cn(
                                  "sticky z-20 bg-staff-surface",
                                  selectable ? "left-11" : "left-0",
                                  stickyEdge,
                                ),
                            )}
                          >
                            {column.headerHidden ? (
                              <span className="sr-only">{column.header}</span>
                            ) : column.sortable ? (
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
                                      column.numeric
                                        ? "ml-auto w-14"
                                        : index === 0
                                          ? "w-3/4"
                                          : "w-1/2",
                                    )}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))
                        : rows.map((row, index) => {
                            const id = getRowId(row);
                            const selected = selectable && isSelected(id);
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
                                      onKeyDown: (
                                        event: React.KeyboardEvent<HTMLTableRowElement>,
                                      ) => onRowKeyDown(event, index, row),
                                      onFocus: (event: React.FocusEvent<HTMLTableRowElement>) => {
                                        if (event.target === event.currentTarget) {
                                          setFocusIndex(index);
                                        }
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
                                  <td
                                    {...selectCellProps(index)}
                                    className={cn(
                                      "cursor-pointer pl-4 [&>button]:flex",
                                      selectSticky,
                                    )}
                                  >
                                    <StaffCheckbox
                                      aria-label={`Select row ${index + 1}`}
                                      checked={selected}
                                      onClick={passClickToCell}
                                      tabIndex={-1}
                                    />
                                  </td>
                                ) : null}
                                {columns.map((column, columnIndex) => {
                                  const truncate = truncationOf(column);
                                  const value = column.cell(row);
                                  const empty = isEmptyCellValue(value);
                                  const content = empty ? <EmptyValue /> : value;
                                  return (
                                    <td
                                      key={column.id}
                                      className={cn(
                                        "px-3 text-staff-fg",
                                        truncate === false && "whitespace-nowrap",
                                        column.numeric && "text-right tabular-nums",
                                        columnIndex === 0 && !selectable && "pl-4",
                                        columnIndex === columns.length - 1 && "pr-4",
                                        column.hideBelow && hideBelowClass[column.hideBelow],
                                        columnIndex === 0 &&
                                          firstSticky(selectable ? "left-11" : "left-0"),
                                      )}
                                    >
                                      {truncate === false || empty ? (
                                        content
                                      ) : (
                                        <TruncatedText mode={truncate}>{content}</TruncatedText>
                                      )}
                                    </td>
                                  );
                                })}
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
                        const selected = selectable && isSelected(id);
                        return (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users open the row through its title link
                          <li
                            key={id}
                            onClick={(event) => onRowClick(event, index, row)}
                            className={cn(
                              "flex min-h-11 items-start gap-1 py-3 pr-4 pl-1 transition-colors",
                              !selectable && "pl-4",
                              onRowOpen && "cursor-pointer active:staff-overlay-pressed",
                              (selected || activeRowId === id) && "staff-overlay-selected",
                            )}
                          >
                            {selectable ? (
                              // A 44px column the height of the row: the whole strip selects.
                              <span
                                {...selectCellProps(index)}
                                className="-my-3 flex w-11 shrink-0 cursor-pointer justify-center self-stretch pt-3.5"
                              >
                                <StaffCheckbox
                                  aria-label={`Select row ${index + 1}`}
                                  checked={selected}
                                  onClick={passClickToCell}
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
                                  {metaColumns.map((column) => {
                                    const value = column.cell(row);
                                    // An empty fact takes no space, so the others stay aligned.
                                    if (isEmptyCellValue(value)) return null;
                                    return (
                                      <span
                                        key={column.id}
                                        className={cn(
                                          "min-w-0 truncate",
                                          column.numeric && "tabular-nums text-staff-fg",
                                        )}
                                      >
                                        {value}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            {actionColumns.map((column) => (
                              <div key={column.id} className="-my-0.5 shrink-0 self-start">
                                {column.cell(row)}
                              </div>
                            ))}
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
              count={selectedCount}
              onClear={clearSelection}
              noun={noun}
              allMatching={allMatching}
              scopeAction={scopeAction}
            >
              {bulkActions(selectedRows, { allMatching, count: selectedCount })}
            </BulkActionBar>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {selectedCount > 0
              ? `${allMatching ? "All " : ""}${COUNT.format(selectedCount)} selected`
              : ""}
          </p>
        </div>
      </TooltipProvider>
    </TableSelectionProvider>
  );
}
