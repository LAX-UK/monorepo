"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { conditionReportColumns } from "@/components/admin/condition-reports-board/columns";
import { ConditionReportDrawerContent } from "@/components/admin/condition-reports-board/drawer";
import { ConditionReportsMobileCards } from "@/components/admin/condition-reports-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin-condition-reports.shared";
import { cn } from "@auction/ui";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useMemo } from "react";

export type ConditionReportsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminConditionReportRequestRow[];
  selected?: AdminConditionReportRequestRow | null;
  onOpen: (row: AdminConditionReportRequestRow) => void;
  onCloseDrawer: () => void;
  pagination?: ConditionReportsBoardPagination | null;
};

export function AdminConditionReportsBoard({
  rows,
  selected = null,
  onOpen,
  onCloseDrawer,
  pagination = null,
}: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(() => conditionReportColumns(onOpen), [onOpen]);

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
                Condition reports
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-secondary px-2 font-label text-xs font-medium text-on-secondary"
              >
                {rows.length}
              </Badge>
            </>
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
            table={
              <AdminDataTable
                ariaLabel="Condition report requests"
                columns={columns}
                data={rows}
                emptyMessage="No condition report requests on this page."
                density={density}
                getRowId={(r) => r.id}
                className="[&_table]:border-0"
              />
            }
            cards={<ConditionReportsMobileCards rows={rows} onOpen={onOpen} />}
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </div>
      <Sheet open={!!selected} onOpenChange={(open) => !open && onCloseDrawer()}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle ?? "Condition report"}
                fullPageHref={`/admin/lots/${selected.lotId}`}
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {selected.requesterEmail?.trim() || "Buyer request"}
                  </p>
                }
              />
              <ConditionReportDrawerContent row={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
