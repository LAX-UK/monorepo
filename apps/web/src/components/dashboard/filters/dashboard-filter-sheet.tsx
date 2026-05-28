"use client";

import { SplitFilterSheet, type SplitFilterSheetProps } from "@/components/ui/split-filter-sheet";

export type DashboardFilterSheetProps = Omit<SplitFilterSheetProps, "description"> & {
  description?: string;
};

/** Bottom sheet below `lg`, right drawer at `lg+` — shell, filters, and list cards share the `lg` breakpoint. */
export function DashboardFilterSheet({
  description = "Refine list results. Changes apply when you confirm.",
  ...props
}: DashboardFilterSheetProps) {
  return <SplitFilterSheet description={description} {...props} />;
}
