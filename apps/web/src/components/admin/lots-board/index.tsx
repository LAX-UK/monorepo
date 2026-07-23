"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import type {
  CatalogTableFilterControlsBaseProps,
  CatalogTableFilterControlsProps,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { AdminLotFilterFields } from "@/components/admin/filters/admin-lot-filter-fields";
import { type AdminLotTableRow, lotColumns } from "@/components/admin/lots-board/columns";
import { LotsMobileCards } from "@/components/admin/lots-board/mobile-cards";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ExportButton } from "@/components/exports/export-button";
import { useTableDensity } from "@/components/layout/density-provider";
import {
  type ConnectRequiredByLotId,
  bulkLotDeletePreflightWarning,
  bulkPublishPreflightWarning,
} from "@/lib/admin/bulk-ops/lot-bulk-result";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import { adminLotEditHref, adminLotHref } from "@/lib/admin/catalog-route-helpers";
import { lotFilterAdapter } from "@/lib/admin/filters/lot-filter-adapter";
import type { LotListSortKey } from "@/lib/admin/lots-list-sort";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { ArtistProfile, CategoryNode, Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { EntityList } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { VisibilityState } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

export type { AdminLotTableRow } from "@/components/admin/lots-board/types";

/** Default lots table layout — secondary columns hidden until enabled in Columns picker. */
export const LOTS_DEFAULT_COLUMN_VISIBILITY = {
  estimate: false,
  photos: false,
  artist: false,
} satisfies VisibilityState;

export const LOTS_COLUMN_VISIBILITY_STORAGE_KEY = "admin-lots-columns-v2";

export type LotsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

export type LotsBoardFilterSheetProps = {
  artistId?: string;
  saleId?: string;
  categoryId?: string;
  sort?: LotListSortKey;
  lens?: string;
};

export type LotsBoardFilterOptions = {
  artists: Pick<ArtistProfile, "id" | "displayName">[];
  sales: Pick<Sale, "id" | "title">[];
  categories: CategoryNode[];
};

type Props = {
  rows: AdminLotTableRow[];
  fullLots: Lot[];
  listError: string | null;
  urlError: string | null;
  statusChips?: ReactNode;
  /** Figma quick status segment (All / Live / Withdraw / Sold). */
  statusQuickFilter?: ReactNode;
  statusQuickFilterMobile?: ReactNode;
  filterControls?: CatalogTableFilterControlsBaseProps;
  lotFilterSheet?: LotsBoardFilterSheetProps;
  lotFilterOptions?: LotsBoardFilterOptions;
  /** Export filter payload for the board header action. */
  exportFilters?: Record<string, unknown>;
  /** Total lots in current lens (for header count badge). */
  listTotalCount?: number;
  /** Board card footer pagination (sales parity). */
  pagination?: LotsBoardPagination | null;
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
  listError,
  urlError: _urlError,
  statusChips,
  statusQuickFilter,
  statusQuickFilterMobile,
  filterControls,
  lotFilterSheet,
  lotFilterOptions,
  exportFilters,
  listTotalCount,
  pagination,
  canManageAuction = false,
  canManageCatalog = false,
  connectRequiredByLotId,
  columnSort,
}: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.id })), [rows]);
  const columns = useMemo(
    () =>
      lotColumns(columnSort, {
        canManageCatalog,
        canManageAuction,
        ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
      }),
    [columnSort, canManageCatalog, canManageAuction, connectRequiredByLotId],
  );
  const bulkOperations = useMemo(() => getLotBulkOperations(canManageAuction), [canManageAuction]);
  const bulkPreflightWarning = useMemo(() => {
    const hints = [
      bulkPublishPreflightWarning(selectedIds, fullLots, connectRequiredByLotId),
      bulkLotDeletePreflightWarning(selectedIds, rows),
    ].filter(Boolean);
    return hints.length > 0 ? hints.join(". ") : null;
  }, [selectedIds, fullLots, connectRequiredByLotId, rows]);

  const tableFilterControls = useMemo((): CatalogTableFilterControlsProps | undefined => {
    if (!filterControls || !lotFilterSheet || !lotFilterOptions) return undefined;
    return {
      ...filterControls,
      ...(statusQuickFilter ? { toolbarMid: statusQuickFilter } : {}),
      ...(statusQuickFilterMobile ? { toolbarMidMobile: statusQuickFilterMobile } : {}),
      sheetFilters: (
        <AdminLotFilterFields
          artists={lotFilterOptions.artists}
          sales={lotFilterOptions.sales}
          categories={lotFilterOptions.categories}
        />
      ),
      transactional: {
        adapter: lotFilterAdapter,
        preserved: {
          ...(lotFilterSheet.lens ? { lens: lotFilterSheet.lens } : {}),
        },
      },
    };
  }, [
    filterControls,
    lotFilterSheet,
    lotFilterOptions,
    statusQuickFilter,
    statusQuickFilterMobile,
  ]);

  const headerCount = listTotalCount ?? rows.length;

  return (
    <div className="space-y-4">
      {listError ? <AdminListAlert title="Could not load lots">{listError}</AdminListAlert> : null}
      <div
        className={cn(
          "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        )}
      >
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Lots
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {headerCount > 99 ? "99+" : headerCount}
              </Badge>
            </>
          }
          {...(tableFilterControls ? { filterControls: tableFilterControls } : {})}
          trailing={
            exportFilters ? (
              <ExportButton key="lots-export" entityType="lots" filters={exportFilters} />
            ) : null
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            density={density}
            filters={null}
            responsiveMode="auto"
            table={
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
                emptyComponent={
                  <FilterEmptyState
                    entity="lots"
                    segment="admin"
                    hasActiveFilters={Boolean(statusChips || statusQuickFilter)}
                    title="No lots in this view"
                  />
                }
                density={density}
                showColumnPicker
                columnVisibilityStorageKey={LOTS_COLUMN_VISIBILITY_STORAGE_KEY}
                defaultColumnVisibility={LOTS_DEFAULT_COLUMN_VISIBILITY}
                className="[&_table]:border-0"
              />
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
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </div>
      <BulkActionsToolbar
        selectedIds={selectedIds}
        operations={bulkOperations}
        onClear={clear}
        preflightWarning={bulkPreflightWarning}
        pageRowCount={pageIds.length}
        onSelectAllOnPage={() => selectAllOnPage(pageIds)}
      />
    </div>
  );
}
