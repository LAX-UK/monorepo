"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function disputeColumns(
  onOpen: (row: AdminDisputeTableRow) => void,
): ColumnDef<AdminDisputeTableRow>[] {
  return [
    {
      accessorKey: "openedAt",
      header: "Opened",
      cell: ({ row }) => <AdminTableDateTimeCell iso={row.original.openedAt} mode="timestamp" />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="dispute" status={row.original.status} />,
    },
    {
      accessorKey: "amountDisplay",
      header: "Amount",
      cell: ({ row }) => (
        <AdminTableMoneyCell display={row.original.amountDisplay} emphasis="default" />
      ),
    },
    {
      accessorKey: "reasonLabel",
      header: "Reason",
      cell: ({ row }) => (
        <span className="max-w-[12rem] truncate font-body text-sm text-on-surface">
          {row.original.reasonLabel}
        </span>
      ),
    },
    {
      accessorKey: "lotTitle",
      header: "Lot",
      cell: ({ row }) =>
        row.original.lotId && row.original.lotTitle ? (
          <Button
            type="button"
            variant="link"
            className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-medium text-link underline-offset-2 hover:underline"
            onClick={() => onOpen(row.original)}
          >
            {row.original.lotTitle}
          </Button>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 font-medium text-link underline-offset-2 hover:underline"
            onClick={() => onOpen(row.original)}
          >
            View case
          </Button>
        ),
    },
    {
      id: "seller",
      header: "Seller",
      cell: ({ row }) => (
        <Link
          href={`/admin/legal-entities/${row.original.sellerLegalEntityId}`}
          className="block max-w-[12rem] truncate text-sm text-link underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.sellerDisplayName ??
            `Entity ${row.original.sellerLegalEntityId.slice(0, 8)}…`}
        </Link>
      ),
      enableSorting: false,
    },
    {
      id: "payment",
      header: "Payment",
      cell: ({ row }) => (
        <Link
          href={`/admin/payments?q=${encodeURIComponent(row.original.paymentId)}`}
          className="font-label text-xs uppercase tracking-wide text-link underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </Link>
      ),
      enableSorting: false,
    },
  ];
}
