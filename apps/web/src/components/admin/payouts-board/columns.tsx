"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { formatDate } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function payoutColumns(
  onOpen: (row: AdminPayoutBoardRow) => void,
): ColumnDef<AdminPayoutBoardRow>[] {
  const open = onOpen;
  return [
    {
      id: "period",
      header: "Period",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 py-0 text-left font-body text-sm text-primary"
          onClick={() => open(row.original)}
        >
          <span className="block whitespace-nowrap">
            {formatDate(row.original.periodStart)} → {formatDate(row.original.periodEnd)}
          </span>
          <AdminTableMoneyCell
            display={row.original.netAmountDisplay}
            emphasis="default"
            className="mt-0.5"
          />
        </Button>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "legalEntityId",
      header: "Entity",
      cell: ({ row }) => (
        <Link
          href={`/admin/legal-entities/${row.original.legalEntityId}`}
          className="text-sm font-medium text-link underline"
        >
          View entity
        </Link>
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
        <Button type="button" variant="secondary" size="sm" onClick={() => open(row.original)}>
          Details
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
