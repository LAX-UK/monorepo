"use client";

import {
  type CatalogSegmentItem,
  CatalogSegmentNav,
} from "@/components/admin/catalog/catalog-segment-nav";
import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { useId, useState } from "react";

export type { CatalogSegmentItem };

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  lensAriaLabel: string;
  sheetTitle?: string;
  sheetFilters: ReactNode;
  activeFilterCount?: number;
  /** When false, hides the filter sheet trigger (e.g. search-only toolbars). */
  showFilterTrigger?: boolean;
  /** Optional search row shown beside More filters on md+ */
  searchSlot?: ReactNode;
  className?: string;
};

/** One lens row + optional search + More filters bottom sheet. */
export function CatalogFilterBar({
  lenses,
  activeLensId,
  lensAriaLabel,
  sheetTitle = "Filters",
  sheetFilters,
  activeFilterCount = 0,
  showFilterTrigger = true,
  searchSlot,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const filterPanelId = useId();

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CatalogSegmentNav items={lenses} activeId={activeLensId} aria-label={lensAriaLabel} />
        <div className="flex shrink-0 items-center gap-2">
          {searchSlot ? (
            <div
              className={cn(
                "min-w-0 flex-1 md:max-w-xs",
                showFilterTrigger ? "hidden sm:block" : "block",
              )}
            >
              {searchSlot}
            </div>
          ) : null}
          {showFilterTrigger ? (
            <MarketingFilterTrigger
              onClick={() => setOpen(true)}
              activeCount={activeFilterCount}
              aria-expanded={open}
              aria-controls={filterPanelId}
            />
          ) : null}
        </div>
      </div>
      {showFilterTrigger ? (
        <MarketingFilterSheet open={open} onOpenChange={setOpen} title={sheetTitle}>
          <div id={filterPanelId} className="space-y-4">
            {searchSlot ? <div className="sm:hidden">{searchSlot}</div> : null}
            {sheetFilters}
          </div>
        </MarketingFilterSheet>
      ) : null}
    </div>
  );
}
