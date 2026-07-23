"use client";

import { useCatalogFilterSheetState } from "@/components/admin/catalog/catalog-filter-sheet-primitive";
import {
  CatalogTableFilterControlsInline,
  CatalogTableFilterControlsMobileSearch,
  CatalogTableFilterControlsSheet,
} from "@/components/admin/catalog/catalog-table-filter-controls/parts";
import type { CatalogTableFilterControlsProps } from "@/components/admin/catalog/catalog-table-filter-controls/types";
import { AdminFilterSheetRoot } from "@/components/admin/filters/admin-filter-sheet-root";
import { cn } from "@auction/ui";

function LegacyCatalogTableFilterControls({
  className,
  ...props
}: CatalogTableFilterControlsProps & { className?: string }) {
  const filterSheet = useCatalogFilterSheetState();
  return (
    <div className={cn("contents", className)}>
      <CatalogTableFilterControlsInline {...props} {...filterSheet} />
      <CatalogTableFilterControlsMobileSearch {...props} />
      <CatalogTableFilterControlsSheet {...props} {...filterSheet} />
    </div>
  );
}

export function CatalogTableFilterControls({
  className,
  transactional,
  ...props
}: CatalogTableFilterControlsProps & { className?: string }) {
  if (transactional) {
    return (
      <AdminFilterSheetRoot adapter={transactional.adapter} preserved={transactional.preserved}>
        <div className={cn("contents", className)}>
          <CatalogTableFilterControlsInline transactional={transactional} {...props} />
          <CatalogTableFilterControlsMobileSearch {...props} />
          <CatalogTableFilterControlsSheet transactional={transactional} {...props} />
        </div>
      </AdminFilterSheetRoot>
    );
  }
  return <LegacyCatalogTableFilterControls {...props} {...(className ? { className } : {})} />;
}

export { useCatalogFilterSheetState as useFilterControlsState };
