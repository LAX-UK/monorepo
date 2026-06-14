"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function sofColumns(onOpen: (row: AdminSofTableRow) => void): ColumnDef<AdminSofTableRow>[] {
  const open = onOpen;
  return [
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
