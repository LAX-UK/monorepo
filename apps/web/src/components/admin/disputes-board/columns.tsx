"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { formatDateTime } from "@/lib/ui/format";
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
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-body text-xs text-on-surface-variant">
          {formatDateTime(row.original.openedAt)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="dispute" status={row.original.status} />,
    },
    {
      accessorKey: "amountLabel",
      header: "Amount",
      cell: ({ row }) => (
        <span className="tabular-nums font-body text-sm">{row.original.amountLabel}</span>
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
            className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onOpen(row.original)}
          >
            {row.original.lotTitle}
          </Button>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 py-0 font-medium text-primary underline-offset-2 hover:underline"
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
          className="block max-w-[12rem] truncate text-sm text-primary underline-offset-2 hover:underline"
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
          className="font-label text-xs uppercase tracking-wide text-primary underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </Link>
      ),
      enableSorting: false,
    },
  ];
}
