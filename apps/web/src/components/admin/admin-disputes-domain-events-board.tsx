"use client";

import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { DataTable, EntityTableShell } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function columns(): ColumnDef<AdminDomainEventRow>[] {
  return [
    {
      accessorKey: "occurredAt",
      header: "When",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-body text-xs text-on-surface-variant">
          {row.original.occurredAt.toISOString()}
        </span>
      ),
    },
    {
      accessorKey: "eventType",
      header: "Type",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-on-surface">{row.original.eventType}</span>
      ),
    },
    {
      id: "aggregate",
      header: "Aggregate",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-on-surface-variant">
          {row.original.aggregateType}:{row.original.aggregateId.slice(0, 8)}…
        </span>
      ),
    },
    {
      accessorKey: "actorUserId",
      header: "Actor",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.actorUserId ?? "—"}</span>
      ),
    },
    {
      id: "payload",
      header: "Payload",
      cell: ({ row }) => (
        <span
          className="max-w-md truncate font-mono text-xs text-on-surface-variant"
          title={JSON.stringify(row.original.payload)}
        >
          {JSON.stringify(row.original.payload)}
        </span>
      ),
      enableSorting: false,
    },
  ];
}

export function AdminDisputesDomainEventsBoard({ rows }: { rows: AdminDomainEventRow[] }) {
  const { density } = useTableDensity();
  const tableColumns = useMemo(() => columns(), []);

  return (
    <EntityTableShell
      density={density}
      responsiveMode="auto"
      table={
        <TableScroll>
          <DataTable columns={tableColumns} data={rows} getRowId={(r) => r.id} density={density} />
        </TableScroll>
      }
    />
  );
}
