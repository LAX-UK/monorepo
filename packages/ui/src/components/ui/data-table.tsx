"use client";

import {
  type ColumnDef,
  type Header,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Checkbox } from "./checkbox.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  /** Custom empty UI (e.g. `EmptyState`) when there are no rows. */
  emptyComponent?: React.ReactNode;
  className?: string;
  /** Accessible name for the table (rendered as visually hidden caption). */
  ariaLabel?: string;
  /** When false, column header sort only reorders the current page in memory (default off for server-driven lists). */
  enableClientSort?: boolean;
  /** When set, shows a selection column and wires TanStack row selection */
  enableRowSelection?: boolean;
  getRowId?: (row: TData, index: number) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Tighter rows for compact density */
  density?: "comfortable" | "compact";
  /** When set, columns can be hidden via `columnVisibility` */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
};

function sortableHeaderLabel<TData, TValue>(header: Header<TData, TValue>): string {
  const def = header.column.columnDef;
  if (typeof def.header === "string" && def.header.trim()) return def.header;
  const rendered = flexRender(def.header, header.getContext());
  if (typeof rendered === "string" && rendered.trim()) return rendered;
  const meta = def.meta as { sortLabel?: string } | undefined;
  if (meta?.sortLabel) return meta.sortLabel;
  return header.column.id.replace(/_/g, " ");
}

function selectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "__select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all rows on this page"
        className="translate-y-0.5"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
        className="translate-y-0.5"
      />
    ),
    enableSorting: false,
    size: 40,
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
  emptyComponent,
  className,
  ariaLabel,
  enableClientSort = false,
  enableRowSelection,
  getRowId,
  rowSelection: controlledSelection,
  onRowSelectionChange,
  density = "comfortable",
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<RowSelectionState>({});
  const rowSelection = controlledSelection ?? uncontrolledSelection;
  const setRowSelection = onRowSelectionChange ?? setUncontrolledSelection;

  const mergedColumns = React.useMemo(() => {
    const withHiding = columns.map((col) => {
      const id = ("accessorKey" in col && col.accessorKey ? String(col.accessorKey) : col.id) ?? "";
      const locked = id === "actions" || id === "__select";
      return {
        ...col,
        enableHiding: col.enableHiding ?? !locked,
      };
    });
    if (!enableRowSelection) return withHiding;
    return [selectionColumn<TData>() as ColumnDef<TData, TValue>, ...withHiding];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: mergedColumns,
    state: {
      sorting,
      rowSelection,
      ...(columnVisibility ? { columnVisibility } : {}),
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
    },
    enableRowSelection: !!enableRowSelection,
    enableSorting: enableClientSort,
    ...(onColumnVisibilityChange ? { onColumnVisibilityChange } : {}),
    getRowId: getRowId ?? ((_, i) => String(i)),
    getCoreRowModel: getCoreRowModel(),
    ...(enableClientSort ? { getSortedRowModel: getSortedRowModel() } : {}),
  });

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-2xl border border-outline-variant/15",
        className,
      )}
    >
      <Table scrollContainer={false} aria-label={ariaLabel}>
        {ariaLabel ? <caption className="sr-only">{ariaLabel}</caption> : null}
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={density === "compact" ? "h-9" : undefined}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = canSort ? header.column.getIsSorted() : false;
                const ariaSort = canSort
                  ? sorted === "asc"
                    ? "ascending"
                    : sorted === "desc"
                      ? "descending"
                      : "none"
                  : undefined;
                const sortButtonLabel = `Sort by ${sortableHeaderLabel(header)}`;
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn("text-on-surface-variant", density === "compact" && "px-2 py-2")}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={sortButtonLabel}
                        className={cn(
                          "-ml-3 font-medium text-on-surface hover:bg-surface-container-high",
                          density === "compact" ? "h-9 px-2" : "h-10 px-3",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="ml-1 inline size-4" aria-hidden />
                        ) : header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="ml-1 inline size-4" aria-hidden />
                        ) : (
                          <ChevronsUpDown className="ml-1 inline size-4 opacity-50" aria-hidden />
                        )}
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={density === "compact" ? "h-10" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={density === "compact" ? "px-2 py-1.5" : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={mergedColumns.length} className="h-24 p-0">
                {emptyComponent ?? (
                  <p className="px-4 py-6 text-center text-on-surface-variant">{emptyMessage}</p>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
