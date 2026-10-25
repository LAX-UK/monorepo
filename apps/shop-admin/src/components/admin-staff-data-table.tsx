"use client";

import { EmptyState } from "@auction/staff-ui";
import { DataTable } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

export type AdminEmptyCopy = { title: string; description: string };

type AdminStaffDataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Says what this list is for and what to do next; shown instead of an empty grid. */
  empty: AdminEmptyCopy;
  /** One level below the heading above the table, so the outline has no gaps. */
  emptyHeadingLevel?: "h2" | "h3";
  getRowId: (row: TData) => string;
  ariaLabel: string;
};

export function AdminStaffDataTable<TData>({
  columns,
  data,
  empty,
  emptyHeadingLevel = "h2",
  getRowId,
  ariaLabel,
}: AdminStaffDataTableProps<TData>) {
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyComponent={
        <EmptyState
          className="border-0 bg-transparent"
          title={empty.title}
          description={empty.description}
          headingLevel={emptyHeadingLevel}
        />
      }
      getRowId={(row, index) => getRowId(row) || String(index)}
      ariaLabel={ariaLabel}
      enableClientSort={false}
    />
  );
}

type RecordRow = {
  /** Stable record id, so React keeps row state across refreshes. */
  id: string;
  cells: ReactNode[];
};

/** Read-only table for the sections of a detail page, built from already-formatted cells. */
export function AdminRecordTable({
  columns,
  rows,
  empty,
  ariaLabel,
}: {
  columns: string[];
  rows: RecordRow[];
  empty: AdminEmptyCopy;
  ariaLabel: string;
}) {
  const columnDefs: ColumnDef<RecordRow, unknown>[] = columns.map((header, index) => ({
    id: `${index}-${header}`,
    header,
    cell: ({ row }) => row.original.cells[index],
  }));
  return (
    <AdminStaffDataTable
      columns={columnDefs}
      data={rows}
      empty={empty}
      emptyHeadingLevel="h3"
      getRowId={(row) => row.id}
      ariaLabel={ariaLabel}
    />
  );
}
