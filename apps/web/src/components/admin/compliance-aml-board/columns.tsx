"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function amlColumns(onOpen: (row: AdminAmlTableRow) => void): ColumnDef<AdminAmlTableRow>[] {
  const open = onOpen;
  return [
    {
      id: "match",
      header: "Match",
      cell: ({ row }) => <AdminStatusBadge domain="amlMatch" status={row.original.matchStatus} />,
    },
    {
      id: "outcome",
      header: "Policy",
      cell: ({ row }) => (
        <AdminStatusBadge domain="amlDecision" status={row.original.decisionOutcome} />
      ),
    },
    {
      id: "categories",
      header: "Categories",
      cell: ({ row }) => (
        <span className="max-w-[14rem] truncate text-sm text-on-surface-variant">
          {row.original.categoriesLabel}
        </span>
      ),
    },
    {
      id: "triage",
      header: "Triage",
      cell: ({ row }) => (
        <span className="text-sm text-on-surface">{row.original.triageLabel}</span>
      ),
    },
    {
      id: "hits",
      header: "Hits",
      cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.totalHits}</span>,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => open(row.original)}>
          Review
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
