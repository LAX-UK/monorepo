"use client";

import {
  saleroomHubColumns,
  saleroomHubRowHref,
} from "@/components/admin/saleroom-hub-board/columns";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { DataTable, EmptyState } from "@auction/staff-ui";
import { useMemo } from "react";

/**
 * Sales that have a room but are not live yet, as a table that stacks into cards on a phone. A
 * row opens the sale's clerk console, like its title link; Cmd- or Ctrl-click and the middle
 * button open it in a new tab.
 */
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
      rowHref={saleroomHubRowHref}
      empty={<EmptyState title="No live or upcoming sales" />}
    />
  );
}
