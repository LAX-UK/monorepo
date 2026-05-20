"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { formatDate, formatMoney } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function payoutColumns(onOpen: (row: AdminPayoutRow) => void): ColumnDef<AdminPayoutRow>[] {
  return [
    {
      accessorKey: "id",
      header: "Payout",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[10rem] truncate px-0 py-0 font-mono text-xs text-primary"
          onClick={() => onOpen(row.original)}
        >
          {row.original.id.slice(0, 8)}…
        </Button>
      ),
    },
    {
      accessorKey: "legalEntityId",
      header: "Entity",
      cell: ({ row }) => (
        <span className="max-w-[8rem] truncate font-mono text-xs">
          {row.original.legalEntityId}
        </span>
      ),
    },
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-on-surface-variant">
          {formatDate(row.original.periodStart)} → {formatDate(row.original.periodEnd)}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "netAmount",
      header: "Net",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatMoney(row.original.netAmount, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="payout" status={row.original.status} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
          Details
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
