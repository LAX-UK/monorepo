"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin-condition-reports.shared";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";

export function conditionReportColumns(
  onOpen: (row: AdminConditionReportRequestRow) => void,
): ColumnDef<AdminConditionReportRequestRow>[] {
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
          {row.original.lotTitle ?? row.original.lotId}
        </Button>
      ),
    },
    {
      accessorKey: "requesterEmail",
      header: "Requester",
      cell: ({ row }) => (
        <span className="max-w-[12rem] truncate text-sm">
          {row.original.requesterEmail ?? row.original.requestedByUserId}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="conditionReport" status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Requested",
      cell: ({ row }) => (
        <AdminTableDateTimeCell iso={row.original.createdAt ?? null} mode="timestamp" />
      ),
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={() => onOpen(row.original)}>
          Open
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
