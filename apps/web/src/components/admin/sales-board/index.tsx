"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { useTableDensity } from "@/components/layout/density-provider";
import { bulkSaleDeletePreflightWarning } from "@/lib/admin/bulk-ops/sale-bulk-result";
import { bulkCancelPreflightWarning, getSaleBulkOperations } from "@/lib/admin/bulk-ops/sales";
import { adminSaleEditHref, adminSaleHref } from "@/lib/admin/catalog-route-helpers";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { EntityList } from "@auction/ui";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { saleBoardColumns } from "./columns";
import { SalesBoardMobileCards } from "./mobile-cards";
import type { AdminSaleBoardRow, SaleColumnSortConfig } from "./types";

export type { AdminSaleBoardRow, SaleColumnSortConfig } from "./types";

type Props = {
  rows: AdminSaleBoardRow[];
  statusChips?: ReactNode;
  toolbarEnd?: ReactNode;
  canManageSales?: boolean;
  listError?: string | null;
  columnSort?: SaleColumnSortConfig;
};

export function AdminSalesBoard({
  rows,
  statusChips,
  toolbarEnd,
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

  return (
    <div className="space-y-4">
      {listError ? <AdminListAlert title="Could not load sales">{listError}</AdminListAlert> : null}
      <EntityList
        responsiveMode="auto"
        density={density}
        filters={statusChips ?? null}
        toolbarEnd={toolbarEnd}
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
