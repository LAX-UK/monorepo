"use client";

import {
  CatalogFilterSheetPanel,
  CatalogFilterSheetTrigger,
  renderAdminSearchSlot,
  useCatalogFilterSheetState,
} from "@/components/admin/catalog/catalog-filter-sheet-primitive";
import {
  type CatalogSegmentItem,
  CatalogSegmentNav,
  type CatalogSegmentNavProps,
} from "@/components/admin/catalog/catalog-segment-nav";
import type { CatalogTableTransactionalConfig } from "@/components/admin/catalog/catalog-table-filter-controls";
import {
  AdminFilterSheetPanel,
  AdminFilterSheetRoot,
  AdminFilterSheetTrigger,
} from "@/components/admin/filters/admin-filter-sheet-root";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type AdminFilterLens = CatalogSegmentItem;

type Props = {
  lenses?: readonly AdminFilterLens[];
  activeLensId?: string;
  lensAriaLabel?: string;
  sheetTitle?: string;
  sheetFilters?: ReactNode;
  activeFilterCount?: number;
  showSearch?: boolean;
  showFilterTrigger?: boolean;
  searchSlot?: ReactNode;
  activeFilters?: ReactNode;
  toolbarEnd?: ReactNode;
  LensNav?: (props: CatalogSegmentNavProps) => ReactNode;
  className?: string;
  transactional?: CatalogTableTransactionalConfig;
};

type ContentProps = Props & {
  filterSheet?: ReturnType<typeof useCatalogFilterSheetState>;
};

function AdminFilterBarContent({
  lenses,
  activeLensId,
  lensAriaLabel = "View",
  sheetTitle = "Filters",
  sheetFilters,
  activeFilterCount = 0,
  showSearch = true,
  showFilterTrigger = true,
  searchSlot,
  activeFilters,
  toolbarEnd,
  LensNav: LensNavComponent,
  className,
  transactional,
  filterSheet,
}: ContentProps) {
  const LensNav = LensNavComponent ?? CatalogSegmentNav;
  const hasLenses = lenses != null && lenses.length > 0 && activeLensId != null;

  const filterTrigger =
    showFilterTrigger && sheetFilters ? (
      transactional ? (
        <AdminFilterSheetTrigger activeCount={activeFilterCount} />
      ) : filterSheet ? (
        <CatalogFilterSheetTrigger {...filterSheet} activeCount={activeFilterCount} />
      ) : null
    ) : null;

  const filterPanel =
    showFilterTrigger && sheetFilters ? (
      transactional ? (
        <AdminFilterSheetPanel title={sheetTitle}>
          {showSearch && searchSlot ? (
            <div className="lg:hidden">{renderAdminSearchSlot(searchSlot, "sheet")}</div>
          ) : null}
          {sheetFilters}
        </AdminFilterSheetPanel>
      ) : filterSheet ? (
        <CatalogFilterSheetPanel {...filterSheet} title={sheetTitle}>
          {showSearch && searchSlot ? (
            <div className="lg:hidden">{renderAdminSearchSlot(searchSlot, "sheet")}</div>
          ) : null}
          {sheetFilters}
        </CatalogFilterSheetPanel>
      ) : null
    ) : null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {hasLenses ? (
          <LensNav items={lenses} activeId={activeLensId} aria-label={lensAriaLabel} />
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showSearch && searchSlot ? (
            <div
              className={cn(
                "min-w-0 flex-1 lg:max-w-md",
                showFilterTrigger ? "hidden lg:block" : "block w-full",
              )}
            >
              {renderAdminSearchSlot(searchSlot, "toolbar")}
            </div>
          ) : null}
          {filterTrigger}
          {toolbarEnd}
        </div>
      </div>
      {showSearch && searchSlot && showFilterTrigger ? (
        <div className="lg:hidden">{renderAdminSearchSlot(searchSlot, "mobile")}</div>
      ) : null}
      {activeFilters}
      {filterPanel}
    </div>
  );
}

/** Admin list sticky filter chrome: optional lenses, search, Filters drawer, applied chips. */
export function AdminFilterBar(props: Props) {
  const filterSheet = useCatalogFilterSheetState();

  if (props.transactional) {
    return (
      <AdminFilterSheetRoot
        adapter={props.transactional.adapter}
        preserved={props.transactional.preserved}
      >
        <AdminFilterBarContent {...props} />
      </AdminFilterSheetRoot>
    );
  }

  return <AdminFilterBarContent {...props} filterSheet={filterSheet} />;
}
