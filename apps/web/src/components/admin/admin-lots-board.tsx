"use client";

import { AdminAuctionPipeline } from "@/components/admin/admin-auction-pipeline";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { useTableDensity } from "@/components/layout/density-provider";
import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/ui/table-scroll";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import { lotStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { Lot } from "@auction/types";
import type { LotStatus } from "@auction/types";
import { DataTable, EmptyState, EntityList, InlineActionMenu, StatusBadge } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo } from "react";

export type AdminLotTableRow = {
  id: string;
  title: string;
  auctionType: string;
  status: LotStatus;
  endTimeIso: string;
  endTimeLabel: string;
  currentPrice: string;
};

function LotActionMenu({ row }: { row: AdminLotTableRow }) {
  const router = useRouter();
  return (
    <InlineActionMenu
      label={`Actions for ${row.title}`}
      items={[
        {
          type: "item",
          label: "Open detail",
          onSelect: () => router.push(`/admin/lots/${row.id}`),
        },
        {
          type: "item",
          label: "Copy lot ID",
          onSelect: () => void navigator.clipboard.writeText(row.id),
        },
      ]}
    />
  );
}

function LotsLayoutToggle({
  searchQuery,
  viewPipeline,
}: {
  searchQuery: string;
  viewPipeline: boolean;
}) {
  const pipelineHref = (() => {
    const qs = new URLSearchParams();
    qs.set("view", "pipeline");
    if (searchQuery) qs.set("q", searchQuery);
    return `/admin/lots?${qs.toString()}`;
  })();
  const tableHref =
    searchQuery.length > 0 ? `/admin/lots?q=${encodeURIComponent(searchQuery)}` : "/admin/lots";

  return (
    <fieldset className="flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Layout</legend>
      <Link
        href={tableHref}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors ${
          !viewPipeline
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Table
      </Link>
      <Link
        href={pipelineHref}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors ${
          viewPipeline
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Pipeline
      </Link>
    </fieldset>
  );
}

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
          {lotStatusLabel[row.original.status] ?? row.original.status}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "endTimeLabel",
      header: "Ends",
      cell: ({ row }) => (
        <time dateTime={row.original.endTimeIso} className="text-xs text-on-surface-variant">
          {row.original.endTimeLabel}
        </time>
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
      cell: ({ row }) => <LotActionMenu row={row.original} />,
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
  statusChips?: ReactNode;
  /** Trimmed search query (?q=) for layout links; rendered only on the client. */
  searchQuery: string;
};

export function AdminLotsBoard({
  rows,
  fullLots,
  viewPipeline,
  listError,
  urlError,
  statusChips,
  searchQuery,
}: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.id })), [rows]);
  const columns = useMemo(() => lotColumns(), []);
  const bulkOperations = useMemo(() => getLotBulkOperations(), []);

  if (viewPipeline) {
    return (
      <div className="space-y-8">
        {listError || urlError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load lots</AlertTitle>
            <AlertDescription>{listError ?? urlError}</AlertDescription>
          </Alert>
        ) : null}
        <LotsLayoutToggle searchQuery={searchQuery} viewPipeline={viewPipeline} />
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
      <EntityList
        density={density}
        filters={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {statusChips ?? null}
            {statusChips ? (
              <span
                className="hidden h-6 w-px shrink-0 bg-outline-variant/30 sm:block"
                aria-hidden
              />
            ) : null}
            <LotsLayoutToggle searchQuery={searchQuery} viewPipeline={viewPipeline} />
          </div>
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
                className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-3"
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
                  <LotActionMenu row={r} />
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
