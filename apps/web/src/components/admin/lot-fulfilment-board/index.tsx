"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminLotFulfilmentQueueCard } from "@/components/admin/admin-lot-fulfilment-queue-card";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { lotFulfilmentColumns } from "@/components/admin/lot-fulfilment-board/columns";
import { LotFulfilmentMobileCards } from "@/components/admin/lot-fulfilment-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin-lot-fulfilment.shared";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { ReactNode } from "react";
import { useMemo } from "react";

export type LotFulfilmentBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminLotFulfilmentListRow[];
  selected?: AdminLotFulfilmentListRow | null;
  onOpen: (row: AdminLotFulfilmentListRow) => void;
  onCloseDrawer: () => void;
  returnStatus: string;
  statusChips?: ReactNode;
  pagination?: LotFulfilmentBoardPagination | null;
};

export function AdminLotFulfilmentBoard({
  rows,
  selected = null,
  onOpen,
  onCloseDrawer,
  returnStatus,
  statusChips,
  pagination = null,
}: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(() => lotFulfilmentColumns(onOpen), [onOpen]);

  return (
    <>
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Fulfilment
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-secondary px-2 font-label text-xs font-medium text-on-secondary"
              >
                {rows.length}
              </Badge>
            </>
          }
          trailing={statusChips ?? null}
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
            table={
              <AdminDataTable
                ariaLabel="Lot fulfilment"
                columns={columns}
                data={rows}
                emptyMessage="No fulfilment rows in this view."
                density={density}
                getRowId={(r) => r.id}
                className="[&_table]:border-0"
              />
            }
            cards={<LotFulfilmentMobileCards rows={rows} onOpen={onOpen} />}
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </CatalogBoardCard>
      <Sheet open={!!selected} onOpenChange={(open) => !open && onCloseDrawer()}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle ?? "Lot fulfilment"}
                fullPageHref={`/admin/lots/${selected.lotId}`}
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {selected.status.replaceAll("_", " ")}
                  </p>
                }
              />
              <AdminLotFulfilmentQueueCard row={selected} returnStatus={returnStatus} embedded />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
