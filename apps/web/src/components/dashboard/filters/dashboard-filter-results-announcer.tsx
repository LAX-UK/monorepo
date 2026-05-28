"use client";

import { formatDashboardFilterResults } from "@/lib/dashboard/filters/format-filter-results";
import { DashboardFilterLiveRegion } from "./dashboard-filter-live-region";

export type DashboardFilterResultsAnnouncerProps = {
  count: number;
  entityLabel: string;
};

/** Debounced polite announcement after filters settle. */
export function DashboardFilterResultsAnnouncer({
  count,
  entityLabel,
}: DashboardFilterResultsAnnouncerProps) {
  return <DashboardFilterLiveRegion message={formatDashboardFilterResults(count, entityLabel)} />;
}
