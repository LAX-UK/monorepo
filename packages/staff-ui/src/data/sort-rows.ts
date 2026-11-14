"use client";

import * as React from "react";
import type { DataColumn, SortState } from "./types.js";

export function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * The rows in the order a `DataTable` shows them for `sort`: by the column's `sortValue`, ties in
 * the server's order in both directions, empty values always last. The rows as given when the
 * sort or its column's `sortValue` is missing.
 */
export function sortRows<T>(
  data: readonly T[],
  columns: readonly DataColumn<T>[],
  sort: SortState | null | undefined,
): readonly T[] {
  if (!sort) return data;
  const value = columns.find((column) => column.id === sort.columnId)?.sortValue;
  if (!value) return data;
  const sign = sort.direction === "desc" ? -1 : 1;
  return [...data].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return compareSortValues(x, y);
    return sign * compareSortValues(x, y);
  });
}

/**
 * A list sorted on the page, with the order known to the app: for a work queue, whose panel steps
 * through the rows (J and K) in the order shown. Pass `rows` as the table's data and `sort` and
 * `onSortChange` to the table.
 */
export function useSortedRows<T>({
  data,
  columns,
  defaultSort,
}: {
  data: readonly T[];
  columns: readonly DataColumn<T>[];
  defaultSort?: SortState;
}): { rows: readonly T[]; sort: SortState | null; onSortChange: (sort: SortState) => void } {
  const [sort, setSort] = React.useState<SortState | null>(defaultSort ?? null);
  const rows = React.useMemo(() => sortRows(data, columns, sort), [data, columns, sort]);
  return { rows, sort, onSortChange: setSort };
}
