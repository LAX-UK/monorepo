"use client";

import { DashboardFilterLiveRegion } from "@/components/dashboard/filters/dashboard-filter-live-region";
import { SplitFilterSheet, type SplitFilterSheetProps } from "@/components/ui/split-filter-sheet";

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
      {applyLabel ? <DashboardFilterLiveRegion message={applyLabel} /> : null}
      <SplitFilterSheet
        description={description}
        {...props}
        {...(applyLabel !== undefined ? { applyLabel } : {})}
      />
    </>
  );
}
