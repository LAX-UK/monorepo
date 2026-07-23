"use client";

import {
  CatalogTableFilterControlsInline,
  CatalogTableFilterControlsMobileSearch,
  type CatalogTableFilterControlsProps,
  CatalogTableFilterControlsSheet,
  useFilterControlsState,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { AdminFilterSheetRoot } from "@/components/admin/filters/admin-filter-sheet-root";
import type { ReactNode } from "react";

type Props = {
  leading: ReactNode;
  trailing?: ReactNode;
  filterControls?: CatalogTableFilterControlsProps;
};

/** Shared table card header — title row + toolbar row (search, mid slot, Filters). */
export function CatalogBoardTableHeader({ leading, trailing, filterControls }: Props) {
  const legacyFilterState = useFilterControlsState();
  const transactional = filterControls?.transactional;

  const toolbar =
    filterControls != null ? (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-stroke px-4 py-3 sm:px-6">
        <CatalogTableFilterControlsInline
          {...filterControls}
          {...(transactional ? {} : legacyFilterState)}
        />
        {trailing ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:hidden">{trailing}</div>
        ) : null}
      </div>
    ) : null;

  const mobileAndSheet =
    filterControls != null ? (
      <>
        <CatalogTableFilterControlsMobileSearch {...filterControls} />
        <CatalogTableFilterControlsSheet
          {...filterControls}
          {...(transactional ? {} : legacyFilterState)}
        />
      </>
    ) : null;

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell-stroke px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">{leading}</div>
        {trailing ? (
          <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex">{trailing}</div>
        ) : null}
      </div>
      {toolbar}
      {mobileAndSheet}
    </>
  );

  if (transactional) {
    return (
      <AdminFilterSheetRoot adapter={transactional.adapter} preserved={transactional.preserved}>
        {body}
      </AdminFilterSheetRoot>
    );
  }

  return body;
}
