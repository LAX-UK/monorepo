"use client";

import { AdminAuctionPipeline } from "@/components/admin/admin-auction-pipeline";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { type AdminLotTableRow, lotColumns } from "@/components/admin/lots-board/columns";
import { LotsLayoutToggle } from "@/components/admin/lots-board/layout-toggle";
import { LotsMobileCards } from "@/components/admin/lots-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { TableScroll } from "@/components/ui/table-scroll";
import {
  type ConnectRequiredByLotId,
  bulkPublishPreflightWarning,
} from "@/lib/admin/bulk-ops/lot-bulk-result";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import { adminLotEditHref, adminLotHref, adminLotNewHref } from "@/lib/admin/catalog-route-helpers";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { Lot } from "@auction/types";
import { EntityList } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

export type { AdminLotTableRow } from "@/components/admin/lots-board/types";

type Props = {
  rows: AdminLotTableRow[];
  fullLots: Lot[];
  viewPipeline: boolean;
  listError: string | null;
  urlError: string | null;
  statusChips?: ReactNode;
  /** Trimmed search query (?q=) for layout links; rendered only on the client. */
  searchQuery: string;
  /** Serializable list URL params for layout toggle. */
  listParams?: Record<string, string | undefined>;
  /** When false, bulk Cancel is hidden (requires auction.manage). */
  canManageAuction?: boolean;
  /** When true, row menu includes publish for draft lots. */
  canManageCatalog?: boolean;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  /** Server-driven column sort (list page passes href builder). */
  columnSort?: import("@/components/admin/lots-board/columns").LotColumnSortConfig;
};

export function AdminLotsBoard({
  rows,
  fullLots,
  viewPipeline,
  listError,
  urlError: _urlError,
  statusChips,
  searchQuery: _searchQuery,
  listParams = {},
  canManageAuction = false,
  canManageCatalog = false,
  connectRequiredByLotId,
  columnSort,
}: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.id })), [rows]);
  const columns = useMemo(
    () => lotColumns(columnSort, { canManageCatalog }),
    [columnSort, canManageCatalog],
  );
  const bulkOperations = useMemo(() => getLotBulkOperations(canManageAuction), [canManageAuction]);
  const bulkPreflightWarning = useMemo(
    () => bulkPublishPreflightWarning(selectedIds, fullLots, connectRequiredByLotId),
    [selectedIds, fullLots, connectRequiredByLotId],
  );

  if (viewPipeline) {
    return (
      <div className="space-y-8">
        {listError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load lots</AlertTitle>
            <AlertDescription>{listError}</AlertDescription>
          </Alert>
        ) : null}
        <LotsLayoutToggle listParams={listParams} viewPipeline={viewPipeline} />
        {fullLots.length === 0 && !listError ? (
          <AdminEmptyState
            title="No lots in the pipeline"
            description="Create draft lots to see them grouped by operational status."
            action={
              <Button variant="primary" asChild>
                <Link href={adminLotNewHref()}>New lot</Link>
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
      {listError ? <AdminListAlert title="Could not load lots">{listError}</AdminListAlert> : null}
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
            <LotsLayoutToggle listParams={listParams} viewPipeline={viewPipeline} />
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
              stickyHeader
              enableKeyboardNav
              getRowId={(r) => r.id}
              getRowHref={(r) => adminLotHref(r.id)}
              getRowEditHref={(r) => adminLotEditHref(r.id)}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              density={density}
              showColumnPicker
              columnVisibilityStorageKey="admin-lots-columns"
            />
          </TableScroll>
        }
        cards={
          <LotsMobileCards
            rows={data}
            canManageCatalog={canManageCatalog}
            canManageAuction={canManageAuction}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
          />
        }
      />
      <BulkActionsToolbar
        selectedIds={selectedIds}
        operations={bulkOperations}
        onClear={clear}
        preflightWarning={bulkPreflightWarning}
      />
    </div>
  );
}
