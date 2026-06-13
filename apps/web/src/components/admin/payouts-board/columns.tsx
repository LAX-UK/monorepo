"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { formatDate, formatMoney } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function payoutColumns(onOpen: (row: AdminPayoutRow) => void): ColumnDef<AdminPayoutRow>[] {
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
          <span className="mt-0.5 block text-xs font-medium tabular-nums text-on-surface">
            {formatMoney(row.original.netAmount, row.original.currency)}
          </span>
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
