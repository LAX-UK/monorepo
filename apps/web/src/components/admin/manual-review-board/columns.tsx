"use client";

import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function manualReviewColumns(
  onOpen: (row: AdminManualReviewPaymentRow) => void,
): ColumnDef<AdminManualReviewPaymentRow>[] {
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
          {row.original.lotTitle}
        </Button>
      ),
    },
    {
      id: "lotRef",
      header: "Ref",
      cell: ({ row }) =>
        row.original.lotNumber == null ? (
          <span className="text-on-surface-variant">—</span>
        ) : (
          <span className="text-sm">Lot {row.original.lotNumber}</span>
        ),
    },
    {
      accessorKey: "winnerEmail",
      header: "Winner",
      cell: ({ row }) => (
        <span className="max-w-[12rem] truncate text-sm">{row.original.winnerEmail}</span>
      ),
    },
    {
      accessorKey: "sellerDisplayName",
      header: "Archived seller",
      cell: ({ row }) => <span className="text-sm">{row.original.sellerDisplayName}</span>,
    },
    {
      accessorKey: "amountDisplay",
      header: "Amount",
      cell: ({ row }) => (
        <AdminTableMoneyCell display={row.original.amountDisplay} emphasis="default" />
      ),
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
          Review
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
