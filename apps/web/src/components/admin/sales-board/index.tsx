"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import type {
  CatalogTableFilterControlsBaseProps,
  CatalogTableFilterControlsProps,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { AdminSaleFilterFields } from "@/components/admin/filters/admin-sale-filter-fields";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ExportButton } from "@/components/exports/export-button";
import { useTableDensity } from "@/components/layout/density-provider";
import { bulkSaleDeletePreflightWarning } from "@/lib/admin/bulk-ops/sale-bulk-result";
import { bulkCancelPreflightWarning, getSaleBulkOperations } from "@/lib/admin/bulk-ops/sales";
import { adminSaleEditHref, adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import type { SaleLensId } from "@/lib/admin/catalog/sales-lenses";
import { saleFilterAdapter } from "@/lib/admin/filters/sale-filter-adapter";
import type { SaleListSortKey } from "@/lib/admin/sales-list-sort";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { EntityList } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { saleBoardColumns } from "./columns";
import { SalesBoardMobileCards } from "./mobile-cards";
import type { AdminSaleBoardRow, SaleColumnSortConfig } from "./types";

export type { AdminSaleBoardRow, SaleColumnSortConfig } from "./types";

export type SaleBoardFilterSheetProps = {
  activeLensId: SaleLensId;
  lifecycle?: string;
  delivery?: string;
  sort?: SaleListSortKey;
};

export type SalesBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminSaleBoardRow[];
  statusChips?: ReactNode;
  filterControls?: CatalogTableFilterControlsBaseProps;
  saleFilterSheet?: SaleBoardFilterSheetProps;
  /** Export filter payload for the board header action. */
  exportFilters?: Record<string, unknown>;
  /** Board card footer pagination (lots parity). */
  pagination?: SalesBoardPagination | null;
  /** Total sales in current lens (for header count badge). */
  listTotalCount?: number;
  canManageSales?: boolean;
  listError?: string | null;
  columnSort?: SaleColumnSortConfig;
};

export function AdminSalesBoard({
  rows,
  statusChips,
  filterControls,
  saleFilterSheet,
  exportFilters,
  pagination,
  listTotalCount,
  canManageSales = false,
  listError = null,
  columnSort,
}: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(
    () => saleBoardColumns(columnSort, canManageSales),
    [columnSort, canManageSales],
  );
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const pageIds = useMemo(() => rows.map((r) => r.saleId), [rows]);
  const bulkOperations = useMemo(() => getSaleBulkOperations(canManageSales), [canManageSales]);
  const bulkPreflightWarning = useMemo(() => {
    const hints = [
      bulkCancelPreflightWarning(selectedIds, rows),
      bulkSaleDeletePreflightWarning(selectedIds, rows),
    ].filter(Boolean);
    return hints.length > 0 ? hints.join(". ") : null;
  }, [selectedIds, rows]);

  const tableFilterControls = useMemo((): CatalogTableFilterControlsProps | undefined => {
    if (!filterControls || !saleFilterSheet) return undefined;
    return {
      ...filterControls,
      sheetFilters: <AdminSaleFilterFields activeLensId={saleFilterSheet.activeLensId} />,
      transactional: {
        adapter: saleFilterAdapter,
        preserved: {
          lens: saleFilterSheet.activeLensId,
          ...(saleFilterSheet.lifecycle ? { lifecycle: saleFilterSheet.lifecycle } : {}),
        },
      },
    };
  }, [filterControls, saleFilterSheet]);

  const headerCount = listTotalCount ?? rows.length;

  return (
    <div className="space-y-4">
      {listError ? <AdminListAlert title="Could not load sales">{listError}</AdminListAlert> : null}
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Sales
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
            exportFilters ? <ExportButton entityType="sales" filters={exportFilters} /> : null
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
            filters={statusChips ?? null}
            table={
              <AdminDataTable
                ariaLabel="Sales"
                columns={columns}
                data={rows}
                emptyComponent={
                  <FilterEmptyState
                    entity="sales"
                    segment="admin"
                    hasActiveFilters={Boolean(statusChips)}
                    title="No sales in this view"
                  />
                }
                density={density}
                enableRowSelection
                getRowId={(r) => r.saleId}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                showColumnPicker
                columnVisibilityStorageKey="admin-sales-columns"
                stickyHeader
                enableKeyboardNav
                getRowHref={(r) => adminSaleHref(r.saleId)}
                getRowEditHref={(r) => adminSaleEditHref(r.saleId)}
                className="[&_table]:border-0"
              />
            }
            cards={
              <SalesBoardMobileCards
                rows={rows}
                canManageSales={canManageSales}
                rowSelection={rowSelection}
                onRowSelectionChange={(saleId, checked) => {
                  setRowSelection((prev) => ({ ...prev, [saleId]: checked }));
                }}
              />
            }
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </CatalogBoardCard>
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
