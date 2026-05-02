"use client";

import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
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
  className?: string;
  /** When set, shows a selection column and wires TanStack row selection */
  enableRowSelection?: boolean;
  getRowId?: (row: TData, index: number) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Tighter rows for compact density */
  density?: "comfortable" | "compact";
};

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
  className,
  enableRowSelection,
  getRowId,
  rowSelection: controlledSelection,
  onRowSelectionChange,
  density = "comfortable",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [uncontrolledSelection, setUncontrolledSelection] = React.useState<RowSelectionState>({});
  const rowSelection = controlledSelection ?? uncontrolledSelection;
  const setRowSelection = onRowSelectionChange ?? setUncontrolledSelection;

  const mergedColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;
    return [selectionColumn<TData>() as ColumnDef<TData, TValue>, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: mergedColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
    },
    enableRowSelection: !!enableRowSelection,
    getRowId: getRowId ?? ((_, i) => String(i)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-md border border-outline-variant/15",
        className,
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={density === "compact" ? "h-9" : undefined}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn("text-on-surface-variant", density === "compact" && "px-2 py-2")}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(
                        "-ml-3 font-medium text-on-surface hover:bg-surface-container-high",
                        density === "compact" ? "h-9 px-2" : "h-8 px-3",
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
              ))}
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
              <TableCell
                colSpan={mergedColumns.length}
                className="h-24 text-center text-on-surface-variant"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
