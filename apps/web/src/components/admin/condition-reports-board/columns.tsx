"use client";

import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
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
      cell: ({ row }) => (
        <span className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
          {row.original.status.replaceAll("_", " ")}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Requested",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-on-surface-variant">
          {row.original.createdAt ? formatDateTime(row.original.createdAt) : "—"}
        </span>
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
