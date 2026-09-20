"use client";

import { CatalogFilterLiveRegion } from "./catalog-filter-live-region.js";
import { SplitFilterSheet, type SplitFilterSheetProps } from "./split-filter-sheet.js";

export type MarketingFilterSheetProps = Omit<SplitFilterSheetProps, "description"> & {
  description?: string;
};

/** Bottom sheet on mobile, right drawer on `lg+` — shared marketing filter surface. */
export function MarketingFilterSheet({
  description = "Refine catalogue results. Changes apply when you confirm.",
  applyLabel,
  ...props
}: MarketingFilterSheetProps) {
  return (
    <>
      {applyLabel ? <CatalogFilterLiveRegion message={applyLabel} /> : null}
      <SplitFilterSheet
        description={description}
        {...props}
        {...(applyLabel !== undefined ? { applyLabel } : {})}
      />
    </>
  );
}
