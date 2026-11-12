"use client";

import { FilterSelect } from "@/components/ui/filter-select";
import { SALEROOM_CATALOG_SORT_OPTIONS } from "@/lib/marketing/saleroom-catalog-sort";

/** The catalogue's sort control: a select that keeps the choice in the address. */
export function SaleroomCatalogSort() {
  return (
    <FilterSelect
      param="sort"
      defaultValue="lot"
      options={[...SALEROOM_CATALOG_SORT_OPTIONS]}
      clearParams={["page"]}
      ariaLabel="Sort lots"
      className="h-10 min-h-10 w-auto min-w-[9.5rem] max-w-[12rem] cursor-pointer border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-xs font-medium shadow-none focus:ring-primary"
    />
  );
}
