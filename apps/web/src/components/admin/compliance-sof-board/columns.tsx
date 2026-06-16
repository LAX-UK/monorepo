"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function sofColumns(): ColumnDef<AdminSofTableRow>[] {
  return [
    {
      id: "buyer",
      header: "Buyer",
      cell: ({ row }) => (
        <div className="min-w-[10rem]">
          <Link
            href={`/admin/clients/${row.original.userId}`}
            className="text-link underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.buyerLabel}
          </Link>
          {row.original.pendingCasesForBuyer > 1 ? (
            <span
              className="ml-1 text-xs text-warning"
              title={`${row.original.pendingCasesForBuyer} pending cases for this buyer`}
            >
              ⚠
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "settlement",
      header: "Settlement",
      cell: ({ row }) => (
        <span
          className="max-w-[14rem] truncate text-sm text-on-surface-variant"
          title={row.original.settlementSummary ?? undefined}
        >
          {row.original.settlementSummary ?? "—"}
        </span>
      ),
    },
    {
      id: "trigger",
      header: "Trigger",
      cell: ({ row }) => <span className="font-body text-sm">{row.original.triggerLabel}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="sofCase" status={row.original.displayStatus} />,
    },
    {
      id: "exposure",
      header: "Exposure",
      cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.exposureLabel}</span>,
    },
    {
      id: "triage",
      header: "Triage",
      cell: ({ row }) => (
        <span className="text-sm text-on-surface">{row.original.triageLabel}</span>
      ),
    },
    {
      id: "opened",
      header: "Opened",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-on-surface-variant">
          {row.original.openedLabel}
        </span>
      ),
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href={`/admin/compliance/source-of-funds/${row.original.id}`}>Review</Link>
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
