"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { legalEntityColumns } from "@/components/admin/legal-entities-board/columns";
import { LegalEntityDrawerContent } from "@/components/admin/legal-entities-board/drawer";
import { LegalEntitiesBoardMobileCards } from "@/components/admin/legal-entities-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin-legal-entities.shared";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useMemo } from "react";

export type LegalEntitiesBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  rows: AdminLegalEntityListRow[];
  stripeLens?: boolean;
  selectedEntityId?: string | undefined;
  preview?: AdminLegalEntityDetailBundle | null | undefined;
  listReturnTarget?: string | undefined;
  onOpen: (row: AdminLegalEntityListRow) => void;
  onCloseDrawer: () => void;
  pagination?: LegalEntitiesBoardPagination | null;
};

export function AdminLegalEntitiesBoard({
  rows,
  stripeLens = false,
  selectedEntityId,
  preview = null,
  listReturnTarget,
  onOpen,
  onCloseDrawer,
  pagination = null,
}: Props) {
  const { density } = useTableDensity();
  const columns = useMemo(() => legalEntityColumns(stripeLens, onOpen), [stripeLens, onOpen]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedEntityId) ?? null,
    [rows, selectedEntityId],
  );
  const drawerOpen = Boolean(selectedEntityId && preview);

  return (
    <>
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Legal entities
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
                ariaLabel="Legal entities"
                columns={columns}
                data={rows}
                emptyMessage="No legal entities on this page."
                density={density}
                getRowId={(row) => row.id}
                className="[&_table]:border-0"
              />
            }
            cards={
              <LegalEntitiesBoardMobileCards rows={rows} stripeLens={stripeLens} onOpen={onOpen} />
            }
          />
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </CatalogBoardCard>
      <Sheet open={drawerOpen} onOpenChange={(open) => !open && onCloseDrawer()}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {preview ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={preview.entity.displayName}
                fullPageHref={buildPeopleDetailHref(
                  `/admin/legal-entities/${preview.entity.id}`,
                  listReturnTarget,
                )}
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {formatLegalEntityKindSubkind(preview.entity.kind, preview.entity.subkind)}
                    {selectedRow
                      ? ` · ${stripeLens ? "Stripe lens" : "Directory"}`
                      : " · Off-page preview"}
                  </p>
                }
              />
              <LegalEntityDrawerContent detail={preview} listReturnTarget={listReturnTarget} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
