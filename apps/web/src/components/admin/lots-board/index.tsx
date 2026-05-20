"use client";

import { AdminAuctionPipeline } from "@/components/admin/admin-auction-pipeline";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { type AdminLotTableRow, lotColumns } from "@/components/admin/lots-board/columns";
import { LotsLayoutToggle } from "@/components/admin/lots-board/layout-toggle";
import { LotsMobileCards } from "@/components/admin/lots-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/ui/table-scroll";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { Lot } from "@auction/types";
import { EntityList } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

export type { AdminLotTableRow };

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
          <AdminEmptyState
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
            <AdminDataTable
              ariaLabel="Lots"
              columns={columns}
              data={data}
              enableRowSelection
              enableKeyboardNav
              getRowId={(r) => r.id}
              getRowHref={(r) => `/admin/lots/${r.id}`}
              getRowEditHref={(r) => `/admin/lots/${r.id}/edit`}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              density={density}
              showColumnPicker
              columnVisibilityStorageKey="admin-lots-columns"
            />
          </TableScroll>
        }
        cards={<LotsMobileCards rows={data} />}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
