"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { amlColumns } from "@/components/admin/compliance-aml-board/columns";
import type { AmlBoardPagination } from "@/components/admin/compliance-aml-board/container";
import { AmlDrawerContent } from "@/components/admin/compliance-aml-board/drawer";
import { AmlMobileCards } from "@/components/admin/compliance-aml-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { buildAmlDrawerHref } from "@/lib/admin/compliance/aml-list-href";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

type Props = {
  rows: AdminAmlTableRow[];
  selected: AdminAmlTableRow | null;
  onOpen: (row: AdminAmlTableRow) => void;
  onCloseDrawer: () => void;
  pagination?: AmlBoardPagination | null | undefined;
  capabilities: {
    canTriage: boolean;
    canDecide: boolean;
    currentUserId: string;
  };
};

export function ComplianceAmlBoard({
  rows,
  selected,
  onOpen,
  onCloseDrawer,
  pagination,
  capabilities,
}: Props) {
  const { density } = useTableDensity();
  const searchParams = useSearchParams();
  const columns = useMemo(() => amlColumns(onOpen), [onOpen]);

  return (
    <>
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                AML screenings
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {pagination?.total ?? rows.length}
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
                ariaLabel="AML screenings pending review"
                columns={columns}
                data={rows}
                emptyMessage="No pending AML screenings."
                density={density}
                getRowId={(r) => r.id}
                stickyFirstColumn
                getRowHref={(row) => buildAmlDrawerHref(searchParams, row.id)}
              />
            }
            cards={<AmlMobileCards rows={rows} onOpen={onOpen} />}
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
                title="Watchlist screening"
                subtitle={
                  <div className="flex flex-wrap gap-2">
                    <AdminStatusBadge domain="amlMatch" status={selected.matchStatus} />
                    <AdminStatusBadge domain="amlDecision" status={selected.decisionOutcome} />
                  </div>
                }
              />
              <AmlDrawerContent
                row={selected}
                canTriage={capabilities.canTriage}
                canDecide={capabilities.canDecide}
                currentUserId={capabilities.currentUserId}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
