"use client";

import { AdminLegalEntityPicker } from "@/components/admin/admin-legal-entity-picker";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  legalEntityId?: string | null;
  legalEntityDisplayName?: string | null;
};

export function CatalogVenuesFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
  legalEntityId,
  legalEntityDisplayName,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const rawSp = useSearchParams();

  function setLegalEntityFilter(id: string | null) {
    const sp: Record<string, string | string[] | undefined> = {};
    rawSp.forEach((v, k) => {
      sp[k] = v;
    });
    const href = buildListHref(pathname, sp, {
      legalEntityId: id ?? null,
      offset: "0",
    });
    router.push(href);
  }

  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Venue archive scope"
      sheetTitle="Venue filters"
      activeFilterCount={activeFilterCount}
      showFilterTrigger={true}
      searchSlot={<AdminListSearch placeholder="Search venues…" className="w-full" />}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="font-label text-sm font-medium text-on-surface">Organisation</p>
            <AdminLegalEntityPicker
              value={legalEntityId ?? null}
              displayLabel={legalEntityDisplayName ?? null}
              onChange={(id) => setLegalEntityFilter(id)}
              searchPlaceholder="Filter by organisation…"
            />
            {legalEntityId ? (
              <button
                type="button"
                className="font-label text-xs text-secondary hover:underline"
                onClick={() => setLegalEntityFilter(null)}
              >
                Clear organisation filter
              </button>
            ) : (
              <p className="font-body text-xs text-on-surface-variant">
                Leave empty to show all venues across organisations.
              </p>
            )}
          </div>
          <p className="font-body text-sm text-on-surface-variant">
            Search matches venue names and address fields. Lens toggles archived venues.
          </p>
        </div>
      }
    />
  );
}
