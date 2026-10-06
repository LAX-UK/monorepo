"use client";

import { DataTable } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

type AdminStaffDataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyMessage?: string;
  getRowId: (row: TData) => string;
  ariaLabel: string;
};

export function AdminStaffDataTable<TData>({
  columns,
  data,
  emptyMessage = "No rows yet.",
  getRowId,
  ariaLabel,
}: AdminStaffDataTableProps<TData>) {
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={emptyMessage}
      getRowId={(row, index) => getRowId(row) || String(index)}
      ariaLabel={ariaLabel}
      enableClientSort={false}
    />
  );
}
