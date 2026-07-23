"use client";

import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import { buildListHref } from "@/lib/admin/admin-list-params";

export type ConditionReportLensId = "open" | "pending" | "in_progress" | "fulfilled" | "declined";

const LENSES: { id: ConditionReportLensId; label: string }[] = [
  { id: "open", label: "Open requests" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "declined", label: "Declined" },
];

type Props = {
  activeLensId: ConditionReportLensId;
  searchParams: Record<string, string | string[] | undefined>;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
};

export function CatalogConditionReportsFilterToolbar({
  activeLensId,
  searchParams,
  activeFilterChips = [],
}: Props) {
  const lenses: CatalogSegmentItem[] = LENSES.map((lens) => ({
    id: lens.id,
    label: lens.label,
    href: buildListHref("/admin/condition-reports", searchParams, {
      lens: lens.id === "open" ? "" : lens.id,
      offset: 0,
    }),
  }));

  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Condition report status"
      sheetTitle="Condition report filters"
      sheetFilters={<span className="sr-only">No additional filters</span>}
      showFilterTrigger={false}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
    />
  );
}
