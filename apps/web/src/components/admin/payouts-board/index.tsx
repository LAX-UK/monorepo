"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { payoutColumns } from "@/components/admin/payouts-board/columns";
import type { PayoutsBoardPagination } from "@/components/admin/payouts-board/container";
import { PayoutDrawerContent } from "@/components/admin/payouts-board/drawer";
import { PayoutsMobileCards } from "@/components/admin/payouts-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { buildPayoutsDrawerHref } from "@/lib/admin/payouts-list-href";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { formatDate } from "@/lib/ui/format";
import { EntityList, Sheet, SheetContent, cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo } from "react";

type Props = {
  rows: AdminPayoutBoardRow[];
  selected: AdminPayoutBoardRow | null;
  onOpen: (row: AdminPayoutBoardRow) => void;
  onCloseDrawer: () => void;
  statusChips?: ReactNode;
  pagination?: PayoutsBoardPagination | null | undefined;
  capabilities: {
    canProcess: boolean;
    canReverse: boolean;
  };
};

export function AdminPayoutsBoard({
  rows,
  selected,
  onOpen,
  onCloseDrawer,
  statusChips,
  pagination,
  capabilities,
}: Props) {
  const { density } = useTableDensity();
  const searchParams = useSearchParams();
  const columns = useMemo(() => payoutColumns(onOpen), [onOpen]);

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
                Payouts
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {pagination?.total ?? rows.length}
              </Badge>
            </>
          }
          trailing={
            statusChips ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">{statusChips}</div>
            ) : null
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
            table={
              <AdminDataTable
                ariaLabel="Payouts"
                columns={columns}
                data={rows}
                emptyMessage="No payouts match this filter."
                density={density}
                stickyFirstColumn
                showColumnPicker
                getRowHref={(row) => buildPayoutsDrawerHref(searchParams, row.id)}
              />
            }
            cards={<PayoutsMobileCards rows={rows} onOpen={onOpen} />}
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) onCloseDrawer();
        }}
      >
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Seller payout"
                fullPageHref={buildPayoutsDrawerHref(searchParams, selected.id)}
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {formatDate(selected.periodStart)} → {formatDate(selected.periodEnd)}
                  </p>
                }
              />
              <PayoutDrawerContent payout={selected} capabilities={capabilities} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

export type { PayoutsBoardPagination };
