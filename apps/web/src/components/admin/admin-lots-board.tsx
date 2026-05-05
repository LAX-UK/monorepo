"use client";

import { AdminAuctionPipeline } from "@/components/admin/admin-auction-pipeline";
import type { AdminLotTableRow } from "@/components/admin/admin-lots-data-table";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { useTableDensity } from "@/components/layout/density-provider";
import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/ui/table-scroll";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import { lotStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { Lot } from "@auction/types";
import {
  DataTable,
  EmptyState,
  EntityTableShell,
  InlineActionMenu,
  StatusBadge,
} from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

function lotColumns(): ColumnDef<AdminLotTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link
          href={`/admin/lots/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "auctionType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{row.original.auctionType}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={lotStatusToBadgeVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "endTimeLabel",
      header: "Ends",
      cell: ({ row }) => (
        <span className="text-xs text-on-surface-variant">{row.original.endTimeLabel}</span>
      ),
    },
    {
      accessorKey: "currentPrice",
      header: () => <span className="block text-right">Hammer</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">{row.original.currentPrice}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <InlineActionMenu
          label={`Actions for ${row.original.title}`}
          items={[
            {
              type: "item",
              label: "Open detail",
              onSelect: () => {
                window.location.href = `/admin/lots/${row.original.id}`;
              },
            },
            {
              type: "item",
              label: "Copy lot ID",
              onSelect: () => {
                void navigator.clipboard.writeText(row.original.id);
              },
            },
          ]}
        />
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminLotTableRow[];
  fullLots: Lot[];
  viewPipeline: boolean;
  listError: string | null;
  urlError: string | null;
  statusChips: ReactNode;
  layoutToggle: ReactNode;
};

export function AdminLotsBoard({
  rows,
  fullLots,
  viewPipeline,
  listError,
  urlError,
  statusChips,
  layoutToggle,
}: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.id })), [rows]);
  const columns = useMemo(() => lotColumns(), []);
  const bulkOperations = useMemo(() => getLotBulkOperations(), []);

  if (viewPipeline) {
    return (
      <div className="space-y-8">
        {listError || urlError ? <p className="text-live-red">{listError ?? urlError}</p> : null}
        {layoutToggle}
        {fullLots.length === 0 && !listError ? (
          <EmptyState
            title="No lots in the pipeline"
            description="Create draft lots to see them grouped by operational status."
            action={
              <Button variant="primary" asChild>
                <Link href="/admin/lots/new">New lot</Link>
              </Button>
            }
          />
        ) : (
          <AdminAuctionPipeline auctions={fullLots} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {listError || urlError ? <p className="text-live-red">{listError ?? urlError}</p> : null}
      <EntityTableShell
        density={density}
        filters={
          <>
            {statusChips}
            <span className="hidden h-6 w-px shrink-0 bg-outline-variant/30 sm:block" aria-hidden />
            {layoutToggle}
          </>
        }
        responsiveMode="auto"
        table={
          <TableScroll>
            <DataTable
              columns={columns}
              data={data}
              enableRowSelection
              getRowId={(r) => r.id}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              density={density}
            />
          </TableScroll>
        }
        cards={
          <ul className="space-y-3">
            {data.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-outline-variant/15 bg-surface-container-low/30 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/lots/${r.id}`}
                      className="font-headline text-sm text-primary"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 font-label text-[10px] uppercase text-on-surface-variant">
                      {r.auctionType} · {r.endTimeLabel}
                    </p>
                    <p className="mt-1 font-headline text-sm tabular-nums">{r.currentPrice}</p>
                    <div className="mt-2">
                      <StatusBadge variant={lotStatusToBadgeVariant(r.status)}>
                        {r.status}
                      </StatusBadge>
                    </div>
                  </div>
                  <InlineActionMenu
                    label={`Actions for ${r.title}`}
                    items={[
                      {
                        type: "item",
                        label: "Open detail",
                        onSelect: () => {
                          window.location.href = `/admin/lots/${r.id}`;
                        },
                      },
                      {
                        type: "item",
                        label: "Copy ID",
                        onSelect: () => void navigator.clipboard.writeText(r.id),
                      },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        }
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
