import type * as React from "react";

export type SortDirection = "asc" | "desc";
export type SortState = { columnId: string; direction: SortDirection };
export type TableDensity = "compact" | "comfortable";

/**
 * How a cell that is too long for its column is shortened. `"end"` cuts the end with an ellipsis,
 * `"middle"` keeps both ends of a string (for emails and references that end in what matters),
 * and `false` never shortens: size the column to fit instead. The full value is always shown in a
 * tooltip on hover and stays in the accessible name.
 */
export type CellTruncation = "end" | "middle" | false;

export type DataColumn<T> = {
  id: string;
  header: string;
  /** Keeps the header for screen readers only, e.g. the row actions column. */
  headerHidden?: boolean;
  cell: (row: T) => React.ReactNode;
  /** Right-aligned tabular figures: amounts, counts, dates in fixed formats. */
  numeric?: boolean;
  /** CSS width for the column, e.g. "120px" or "20%". Unset columns share the rest. */
  width?: string;
  /** The column can be sorted; with `sortValue` the table sorts locally, else via onSortChange. */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null;
  /** The direction a first click on this header sorts in; "desc" suits dates and amounts. */
  defaultSortDirection?: SortDirection;
  /**
   * Shortening for long values. Defaults to `"end"`, and to `false` for numeric columns: amounts,
   * statuses and IDs are never shortened, so give those columns room instead.
   */
  truncate?: CellTruncation;
  /** Hidden below this breakpoint in the table layout. */
  hideBelow?: "md" | "lg" | "xl";
  /**
   * The role this column plays in the phone layout: the row's title, a badge on the right, a meta
   * fact under the title, the row's actions at the far right, or left out.
   */
  mobile?: "title" | "badge" | "meta" | "actions" | "hidden";
};

/**
 * "All N matching" selection: every row the list's filters match, across pages. Actions then
 * apply to the filter on the server, not to a list of ids.
 */
export type SelectAllMatching = {
  /** Rows matching the current filters on every page. */
  total: number;
  /** True while the selection is every matching row. */
  active: boolean;
  onActiveChange: (active: boolean) => void;
};

/** What the bulk actions apply to. */
export type BulkSelectionScope = {
  /** True when the selection is every row matching the filters, not only the rows shown. */
  allMatching: boolean;
  /** How many rows the actions apply to. */
  count: number;
};
