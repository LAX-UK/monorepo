"use client";

import {
  type CatalogSegmentItem,
  CatalogSegmentNav,
} from "@/components/admin/catalog/catalog-segment-nav";
import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { useState } from "react";

export type { CatalogSegmentItem };

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  lensAriaLabel: string;
  sheetTitle?: string;
  sheetFilters: ReactNode;
  activeFilterCount?: number;
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
  searchSlot,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CatalogSegmentNav items={lenses} activeId={activeLensId} aria-label={lensAriaLabel} />
        <div className="flex shrink-0 items-center gap-2">
          {searchSlot ? (
            <div className="hidden min-w-0 flex-1 sm:block md:max-w-xs">{searchSlot}</div>
          ) : null}
          <MarketingFilterTrigger onClick={() => setOpen(true)} activeCount={activeFilterCount} />
        </div>
      </div>
      <MarketingFilterSheet open={open} onOpenChange={setOpen} title={sheetTitle}>
        <div className="space-y-4">
          {searchSlot ? <div className="sm:hidden">{searchSlot}</div> : null}
          {sheetFilters}
        </div>
      </MarketingFilterSheet>
    </div>
  );
}
