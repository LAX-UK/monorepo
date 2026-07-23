"use client";

import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  /** When duplicates or lot backfill queues are showing, filters target the indexed list instead. */
  queueModesActive: boolean;
  toolbarEnd?: ReactNode;
};

/** Sticky bar — lens tabs and applied chips only (search/filters live in the table card header). */
export function CatalogArtistsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
  queueModesActive,
  toolbarEnd,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Artist registry view"
      showSearch={false}
      showFilterTrigger={false}
      activeFilterCount={queueModesActive ? 0 : activeFilterCount}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      toolbarEnd={
        queueModesActive ? (
          <div className="space-y-2">
            <p className="font-body text-sm text-on-surface-variant">
              Detailed filters apply to the main artist registry. Use the lenses to return to All,
              Pending, Featured, Maker–sellers, or reopen Review tasks after triage.
            </p>
            <Button variant="secondaryOutline" size="sm" asChild>
              <Link href="/admin/artists">Back to registry list</Link>
            </Button>
          </div>
        ) : (
          toolbarEnd
        )
      }
    />
  );
}
