"use client";

import { SplitFilterSheet, type SplitFilterSheetProps } from "@/components/ui/split-filter-sheet";

export type MarketingFilterSheetProps = Omit<SplitFilterSheetProps, "description"> & {
  description?: string;
};

/** Bottom sheet on mobile, right drawer on `lg+` — shared marketing filter surface. */
export function MarketingFilterSheet({
  description = "Refine catalogue results. Changes apply when you confirm.",
  ...props
}: MarketingFilterSheetProps) {
  return <SplitFilterSheet description={description} {...props} />;
}
