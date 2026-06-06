/** @deprecated Replaced by AdminDisputesBoard — kept for domain-event CSV export flows. */
"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { EntityList } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

function columns(): ColumnDef<AdminDomainEventRow>[] {
  return [
    {
      accessorKey: "occurredAt",
      header: "When",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-body text-xs text-on-surface-variant">
          {formatDateTime(row.original.occurredAt)}
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
    <EntityList
      density={density}
      responsiveMode="auto"
      table={
        <TableScroll>
          <AdminDataTable
            ariaLabel="Disputes"
            columns={tableColumns}
            data={rows}
            getRowId={(r) => r.id}
            density={density}
            emptyComponent={
              <AdminEmptyState
                title="No dispute events"
                description="Payment dispute events will appear here when the payment provider sends them."
              />
            }
            showColumnPicker
            columnVisibilityStorageKey="admin-disputes-columns"
          />
        </TableScroll>
      }
      cards={
        rows.length > 0 ? (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-3"
              >
                <p className="font-mono text-xs text-on-surface">{r.eventType}</p>
                <p className="mt-1 font-body text-xs text-on-surface-variant">
                  {formatDateTime(r.occurredAt)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                  {r.aggregateType}:{r.aggregateId.slice(0, 8)}…
                </p>
              </li>
            ))}
          </ul>
        ) : null
      }
    />
  );
}
