"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminMobileCardList } from "@/components/admin/admin-mobile-card-list";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import { getDisputeBulkOperations } from "@/lib/admin/bulk-ops/disputes";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
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
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const bulkOperations = useMemo(() => getDisputeBulkOperations(), []);

  return (
    <div className="space-y-4">
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
              enableRowSelection
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              showColumnPicker
              columnVisibilityStorageKey="admin-disputes-columns"
            />
          </TableScroll>
        }
        cards={
          <AdminMobileCardList rows={rows} getRowId={(r) => r.id}>
            {(r) => (
              <>
                <p className="font-mono text-xs text-on-surface">{r.eventType}</p>
                <p className="mt-1 font-body text-xs text-on-surface-variant">
                  {r.occurredAt.toISOString()}
                </p>
                <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                  {r.aggregateType}:{r.aggregateId.slice(0, 8)}…
                </p>
              </>
            )}
          </AdminMobileCardList>
        }
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
