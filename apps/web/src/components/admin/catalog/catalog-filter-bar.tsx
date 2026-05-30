"use client";

import {
  type CatalogSegmentItem,
  CatalogSegmentNav,
  type CatalogSegmentNavProps,
} from "@/components/admin/catalog/catalog-segment-nav";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { SplitFilterSheet } from "@/components/ui/split-filter-sheet";
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
  /** Optional search row shown beside More filters on lg+ */
  searchSlot?: ReactNode;
  /** Chips for applied filters (below lens row). */
  activeFilters?: ReactNode;
  /** Override default lens nav (e.g. lots pipeline persistence). */
  LensNav?: (props: CatalogSegmentNavProps) => ReactNode;
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
  activeFilters,
  LensNav: LensNavComponent,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const filterPanelId = useId();
  const LensNav = LensNavComponent ?? CatalogSegmentNav;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LensNav items={lenses} activeId={activeLensId} aria-label={lensAriaLabel} />
        <div className="flex shrink-0 items-center gap-2">
          {searchSlot ? (
            <div
              className={cn(
                "min-w-0 flex-1 lg:max-w-xs",
                showFilterTrigger ? "hidden lg:block" : "block",
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
      {activeFilters}
      {showFilterTrigger ? (
        <SplitFilterSheet
          open={open}
          onOpenChange={setOpen}
          title={sheetTitle}
          description="Refine catalog results. Filter changes apply when you navigate."
        >
          <div id={filterPanelId} className="space-y-4">
            {searchSlot ? <div className="lg:hidden">{searchSlot}</div> : null}
            {sheetFilters}
          </div>
        </SplitFilterSheet>
      ) : null}
    </div>
  );
}
