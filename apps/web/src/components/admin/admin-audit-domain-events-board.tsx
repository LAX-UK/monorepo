"use client";

import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { Button, DataTable, EntityList } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
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
      header: "Event",
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
      id: "timeline",
      header: "Timeline",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/admin/audit/timeline?aggregateType=${encodeURIComponent(row.original.aggregateType)}&aggregateId=${encodeURIComponent(row.original.aggregateId)}`}
          >
            Open
          </Link>
        </Button>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "actorUserId",
      header: "Actor",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.actorUserId ?? "—"}</span>
      ),
    },
    {
      accessorKey: "actingLegalEntityId",
      header: "Entity",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.actingLegalEntityId ?? "—"}</span>
      ),
    },
  ];
}

export function AdminAuditDomainEventsBoard({ rows }: { rows: AdminDomainEventRow[] }) {
  const { density } = useTableDensity();
  const tableColumns = useMemo(() => columns(), []);

  return (
    <EntityList
      density={density}
      responsiveMode="scroll"
      table={
        <TableScroll>
          <DataTable columns={tableColumns} data={rows} getRowId={(r) => r.id} density={density} />
        </TableScroll>
      }
    />
  );
}
