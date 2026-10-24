import type * as React from "react";

export type SortDirection = "asc" | "desc";
export type SortState = { columnId: string; direction: SortDirection };
export type TableDensity = "compact" | "comfortable";

export type DataColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Right-aligned tabular figures: amounts, counts, dates in fixed formats. */
  numeric?: boolean;
  /** CSS width for the column, e.g. "120px" or "20%". Unset columns share the rest. */
  width?: string;
  /** The column can be sorted; with `sortValue` the table sorts locally, else via onSortChange. */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null;
  /** Hidden below this breakpoint in the table layout. */
  hideBelow?: "md" | "lg" | "xl";
  /**
   * The role this column plays in the phone layout: the row's title, a badge on the right, a meta
   * fact under the title, or left out.
   */
  mobile?: "title" | "badge" | "meta" | "hidden";
};
