"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import type {
  ArtistCategoryFilterOption,
  ArtistFilterSheetProps,
} from "@/components/admin/artist-filter-form";
import { artistColumns } from "@/components/admin/artists-board/columns";
import { ArtistsMobileCards } from "@/components/admin/artists-board/mobile-cards";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CatalogBoardCard } from "@/components/admin/catalog/catalog-board-card";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import type {
  CatalogTableFilterControlsBaseProps,
  CatalogTableFilterControlsProps,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { AdminArtistFilterFields } from "@/components/admin/filters/admin-artist-filter-fields";
import { useTableDensity } from "@/components/layout/density-provider";
import { getArtistBulkOperations } from "@/lib/admin/bulk-ops/artists";
import { artistFilterAdapter } from "@/lib/admin/filters/artist-filter-adapter";
import type { AdminFilterPreserved } from "@/lib/admin/filters/types";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { AdminArtistListRow } from "@auction/types";
import { EntityList } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

const ARTIST_LENS_PARAM_KEYS = [
  "status",
  "kinds",
  "kind",
  "linked",
  "featured",
  "verified",
  "archivedOnly",
  "includeArchived",
] as const;

function artistLensPreserved(searchParams: URLSearchParams): AdminFilterPreserved {
  const preserved: Record<string, string | undefined> = {};
  for (const key of ARTIST_LENS_PARAM_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) preserved[key] = value;
  }
  return preserved;
}

export type ArtistsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  prevHref: string | null;
  nextHref: string | null;
};

type Props = {
  artists: AdminArtistListRow[];
  canEdit?: boolean;
  filterControls?: CatalogTableFilterControlsBaseProps;
  artistFilterSheet?: ArtistFilterSheetProps;
  categoryOptions?: readonly ArtistCategoryFilterOption[];
  pagination?: ArtistsBoardPagination | null;
  /** Total artists in current lens (for header count badge). */
  listTotalCount?: number;
};

export function AdminArtistsBoard({
  artists,
  canEdit = false,
  filterControls,
  artistFilterSheet,
  categoryOptions = [],
  pagination,
  listTotalCount,
}: Props) {
  const searchParams = useSearchParams();
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const pageIds = useMemo(() => artists.map((a) => a.id), [artists]);
  const bulkOperations = useMemo(() => getArtistBulkOperations(), []);
  const columns = useMemo(() => artistColumns(canEdit), [canEdit]);

  const tableFilterControls = useMemo((): CatalogTableFilterControlsProps | undefined => {
    if (!filterControls || !artistFilterSheet) return undefined;
    return {
      ...filterControls,
      sheetFilters: <AdminArtistFilterFields categoryOptions={categoryOptions} />,
      transactional: {
        adapter: artistFilterAdapter,
        preserved: artistLensPreserved(searchParams),
      },
    };
  }, [filterControls, artistFilterSheet, categoryOptions, searchParams]);

  const headerCount = listTotalCount ?? artists.length;

  if (artists.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <CatalogBoardCard>
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Artists
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
        />
        <div className="p-4 sm:p-6">
          <EntityList
            density={density}
            responsiveMode="auto"
            table={
              <AdminDataTable
                ariaLabel="Artists"
                columns={columns}
                data={artists}
                getRowId={(r) => r.id}
                getRowHref={(r) => `/admin/artists/${r.id}`}
                getRowEditHref={(r) => (canEdit ? `/admin/artists/${r.id}/edit` : undefined)}
                density={density}
                enableRowSelection
                stickyHeader
                enableKeyboardNav
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                className="[&_table]:border-0"
              />
            }
            cards={
              <ArtistsMobileCards
                artists={artists}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                canEdit={canEdit}
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
        pageRowCount={pageIds.length}
        onSelectAllOnPage={() => selectAllOnPage(pageIds)}
      />
    </div>
  );
}
