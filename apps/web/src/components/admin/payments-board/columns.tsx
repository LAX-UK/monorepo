"use client";

import {
  AdminPaymentActions,
  type AdminPaymentTableRow,
} from "@/components/admin/admin-payments-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function paymentColumns(
  onOpen: (row: AdminPaymentTableRow) => void,
): ColumnDef<AdminPaymentTableRow>[] {
  return [
    {
      accessorKey: "lotTitle",
      header: "Lot",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => onOpen(row.original)}
        >
          {row.original.lotTitle}
        </Button>
      ),
    },
    {
      accessorKey: "buyerId",
      header: "Buyer",
      cell: ({ row }) => (
        <Link
          href={`/admin/clients/${row.original.buyerId}`}
          className="block max-w-[12rem] truncate text-sm font-medium text-primary underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.buyerLabel?.trim() || "View buyer"}
        </Link>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => <span className="tabular-nums">{row.original.amount}</span>,
    },
    {
      accessorKey: "fulfilmentStatus",
      header: "Fulfilment",
      cell: ({ row }) => (
        <span className="max-w-[9rem] font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          {row.original.fulfilmentStatus ? row.original.fulfilmentStatus.replaceAll("_", " ") : "—"}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: "xero",
      header: "Xero",
      cell: ({ row }) =>
        row.original.xeroOnlineInvoiceUrl ? (
          <a
            href={row.original.xeroOnlineInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Invoice
          </a>
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="payment" status={row.original.status} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <div className="flex flex-wrap justify-end gap-3">
          <AdminPaymentActions id={row.original.id} status={row.original.status} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => onOpen(row.original)}
          >
            Details
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
