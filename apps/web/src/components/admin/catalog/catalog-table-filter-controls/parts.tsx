"use client";

import {
  CatalogFilterSheetPanel,
  CatalogFilterSheetTrigger,
  type useCatalogFilterSheetState,
} from "@/components/admin/catalog/catalog-filter-sheet-primitive";
import { TableFilterSearchRow } from "@/components/admin/catalog/catalog-table-filter-controls/search-row";
import type { CatalogTableFilterControlsProps } from "@/components/admin/catalog/catalog-table-filter-controls/types";
import { adminFilterSheetContentClassName } from "@/components/admin/filters/admin-filter-section";
import {
  AdminFilterSheetPanel,
  AdminFilterSheetTrigger,
} from "@/components/admin/filters/admin-filter-sheet-root";

type LegacySheetState = Partial<ReturnType<typeof useCatalogFilterSheetState>>;
type PartProps = CatalogTableFilterControlsProps & LegacySheetState;

export function CatalogTableFilterControlsInline({
  searchPlaceholder,
  activeFilterCount,
  searchInputId = "admin-list-search-q",
  transactional,
  toolbarMid,
  open,
  setOpen,
  hydrated,
  filterPanelId,
}: PartProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="hidden min-w-0 flex-1 lg:block lg:max-w-xs xl:max-w-sm">
        <TableFilterSearchRow
          searchPlaceholder={searchPlaceholder}
          searchInputId={searchInputId}
          placement="toolbar"
        />
      </div>
      {toolbarMid ? <div className="hidden shrink-0 lg:block">{toolbarMid}</div> : null}
      {transactional ? (
        <AdminFilterSheetTrigger activeCount={activeFilterCount} />
      ) : (
        <CatalogFilterSheetTrigger
          open={open ?? false}
          setOpen={setOpen ?? (() => {})}
          hydrated={hydrated ?? false}
          filterPanelId={filterPanelId ?? "filters"}
          activeCount={activeFilterCount}
        />
      )}
    </div>
  );
}

export function CatalogTableFilterControlsMobileSearch({
  searchPlaceholder,
  searchInputId = "admin-list-search-q",
  toolbarMidMobile,
}: Pick<
  CatalogTableFilterControlsProps,
  "searchPlaceholder" | "searchInputId" | "toolbarMidMobile"
>) {
  return (
    <div className="space-y-3 border-b border-shell-stroke px-4 py-3 lg:hidden sm:px-6">
      <TableFilterSearchRow
        searchPlaceholder={searchPlaceholder}
        searchInputId={searchInputId}
        placement="mobile"
      />
      {toolbarMidMobile ? <div>{toolbarMidMobile}</div> : null}
    </div>
  );
}

export function CatalogTableFilterControlsSheet({
  searchPlaceholder,
  sheetTitle = "Filters",
  sheetFilters,
  searchInputId = "admin-list-search-q",
  transactional,
  open,
  setOpen,
  hydrated,
  filterPanelId,
}: PartProps) {
  if (transactional) {
    return (
      <AdminFilterSheetPanel title={sheetTitle}>
        <div key="catalog-filter-sheet-search" className="lg:hidden">
          <TableFilterSearchRow
            searchPlaceholder={searchPlaceholder}
            searchInputId={searchInputId}
            placement="sheet"
          />
        </div>
        <div key="catalog-filter-sheet-filters" className={adminFilterSheetContentClassName}>
          {sheetFilters}
        </div>
      </AdminFilterSheetPanel>
    );
  }

  return (
    <CatalogFilterSheetPanel
      open={open ?? false}
      setOpen={setOpen ?? (() => {})}
      hydrated={hydrated ?? false}
      filterPanelId={filterPanelId ?? "filters"}
      title={sheetTitle}
    >
      <div key="catalog-filter-sheet-search" className="lg:hidden">
        <TableFilterSearchRow
          searchPlaceholder={searchPlaceholder}
          searchInputId={searchInputId}
          placement="sheet"
        />
      </div>
      <div key="catalog-filter-sheet-filters" className={adminFilterSheetContentClassName}>
        {sheetFilters}
      </div>
    </CatalogFilterSheetPanel>
  );
}
