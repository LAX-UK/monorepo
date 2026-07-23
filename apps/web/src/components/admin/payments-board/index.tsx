"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import type {
  CatalogTableFilterControlsBaseProps,
  CatalogTableFilterControlsProps,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { paymentColumns } from "@/components/admin/payments-board/columns";
import { PaymentDrawerContent } from "@/components/admin/payments-board/drawer";
import { PaymentsMobileCards } from "@/components/admin/payments-board/mobile-cards";
import { ExportButton } from "@/components/exports/export-button";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import { cn } from "@auction/ui";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

export type PaymentsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminPaymentTableRow[];
  statusChips?: ReactNode;
  filterControls?: CatalogTableFilterControlsBaseProps;
  /** Export filter payload — includes active search when present. */
  exportFilters?: Record<string, unknown>;
  pagination?: PaymentsBoardPagination | null;
};

export function AdminPaymentsBoard({
  rows,
  statusChips,
  filterControls,
  exportFilters,
  pagination,
}: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminPaymentTableRow | null>(null);

  const onOpen = useCallback((row: AdminPaymentTableRow) => setSelected(row), []);
  const columns = useMemo(() => paymentColumns(onOpen), [onOpen]);

  const tableFilterControls = useMemo((): CatalogTableFilterControlsProps | undefined => {
    if (!filterControls) return undefined;
    return {
      ...filterControls,
      sheetFilters: (
        <p className="font-body text-sm text-on-surface-variant">
          Use search to find payments by lot title or buyer. Status chips above the board filter the
          list.
        </p>
      ),
    };
  }, [filterControls]);

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        )}
      >
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Payments
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-secondary px-2 font-label text-xs font-semibold text-on-secondary"
              >
                {rows.length}
              </Badge>
            </>
          }
          {...(tableFilterControls ? { filterControls: tableFilterControls } : {})}
          trailing={
            <>
              {statusChips ? (
                <span key="payments-status-chips" className="contents">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">{statusChips}</div>
                </span>
              ) : null}
              {exportFilters ? (
                <ExportButton key="payments-export" entityType="payments" filters={exportFilters} />
              ) : null}
            </>
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
            table={
              <AdminDataTable
                ariaLabel="Payments"
                columns={columns}
                data={rows}
                emptyMessage="No payments match this filter."
                density={density}
                stickyFirstColumn
                stickyHeader
                enableKeyboardNav
                getRowHref={(row) => `/admin/payments?paymentId=${row.id}`}
                showColumnPicker
                className="[&_table]:border-0"
              />
            }
            cards={<PaymentsMobileCards rows={rows} onOpen={onOpen} />}
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle}
                fullPageHref="/admin/payments"
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {selected.buyerLabel?.trim() || "Buyer payment"}
                  </p>
                }
              />
              <PaymentDrawerContent p={selected} onClose={() => setSelected(null)} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
