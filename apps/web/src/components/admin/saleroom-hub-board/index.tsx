"use client";

import { saleroomHubColumns } from "@/components/admin/saleroom-hub-board/columns";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { DataTable, EmptyState } from "@auction/staff-ui";
import { useMemo } from "react";

/** Sales that have a room but are not live yet, as a table that stacks into cards on a phone. */
export function AdminSaleroomHubBoard({
  rows,
  label = "Saleroom sales",
}: {
  rows: AdminSaleListRow[];
  label?: string;
}) {
  const columns = useMemo(() => saleroomHubColumns(), []);

  return (
    <DataTable
      label={label}
      columns={columns}
      data={rows}
      getRowId={(row) => row.sale.id}
      empty={<EmptyState title="No live or upcoming sales" />}
    />
  );
}
