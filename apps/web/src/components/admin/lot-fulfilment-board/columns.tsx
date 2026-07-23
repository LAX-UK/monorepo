"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin-lot-fulfilment.shared";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function lotFulfilmentColumns(
  onOpen: (row: AdminLotFulfilmentListRow) => void,
): ColumnDef<AdminLotFulfilmentListRow>[] {
  return [
    {
      accessorKey: "lotTitle",
      header: "Lot",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-medium text-primary"
          onClick={() => onOpen(row.original)}
        >
          {row.original.lotTitle ?? row.original.lotId}
        </Button>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="fulfilment" status={row.original.status} />,
    },
    {
      accessorKey: "fulfilmentMethod",
      header: "Method",
      cell: ({ row }) => <span className="text-sm">{row.original.fulfilmentMethod ?? "—"}</span>,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
          Manage
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
