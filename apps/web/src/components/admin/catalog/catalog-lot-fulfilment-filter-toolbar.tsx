"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import { buildListHref } from "@/lib/admin/admin-list-params";

const FILTER_STATUSES = [
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

type Props = {
  activeStatus: string | undefined;
  searchParams: Record<string, string | string[] | undefined>;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
};

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function CatalogLotFulfilmentFilterToolbar({
  activeStatus,
  searchParams,
  activeFilterChips = [],
}: Props) {
  const lenses: CatalogSegmentItem[] = (["all", ...FILTER_STATUSES] as const).map((s) => ({
    id: s,
    label: s === "all" ? "All" : statusLabel(s),
    href: buildListHref("/admin/lot-fulfilment", searchParams, {
      status: s === "all" ? "" : s,
      offset: 0,
    }),
  }));

  const activeLensId = activeStatus ?? "all";

  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Fulfilment status"
      sheetTitle="Fulfilment filters"
      searchSlot={
        <AdminListSearch placeholder="Search lots or fulfilment ID…" className="w-full" />
      }
      sheetFilters={<span className="sr-only">No additional filters</span>}
      showFilterTrigger={false}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
    />
  );
}
