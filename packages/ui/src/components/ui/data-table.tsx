"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  className?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No results.",
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={cn("w-full overflow-x-auto rounded-md border border-outline-variant/15", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-on-surface-variant">
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="-ml-3 h-8 px-3 font-medium text-on-surface hover:bg-surface-container-high"
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
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-on-surface-variant">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
