"use client";

import {
  type CatalogSegmentItem,
  CatalogSegmentNav,
  type CatalogSegmentNavProps,
} from "@/components/admin/catalog/catalog-segment-nav";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { SplitFilterSheet } from "@/components/ui/split-filter-sheet";
import { cn } from "@auction/ui";
import { type ReactNode, cloneElement, isValidElement, useId, useState } from "react";

export type AdminFilterLens = CatalogSegmentItem;

type Props = {
  /** View lenses only (2–4 segment toggles), not filter enumerations. */
  lenses?: readonly AdminFilterLens[];
  activeLensId?: string;
  lensAriaLabel?: string;
  sheetTitle?: string;
  sheetFilters?: ReactNode;
  activeFilterCount?: number;
  showFilterTrigger?: boolean;
  searchSlot?: ReactNode;
  activeFilters?: ReactNode;
  toolbarEnd?: ReactNode;
  LensNav?: (props: CatalogSegmentNavProps) => ReactNode;
  className?: string;
};

type SearchSlotProps = { inputId?: string; paramName?: string };

function renderSearchSlot(slot: ReactNode, placement: "toolbar" | "mobile" | "sheet"): ReactNode {
  if (!slot) return null;
  if (!isValidElement<SearchSlotProps>(slot)) return slot;
  const base = slot.props.inputId ?? `admin-list-search-${slot.props.paramName ?? "q"}`;
  return cloneElement<SearchSlotProps>(slot, { inputId: `${base}-${placement}` });
}

/** Admin list sticky filter chrome: optional lenses, search, Filters drawer, applied chips. */
export function AdminFilterBar({
  lenses,
  activeLensId,
  lensAriaLabel = "View",
  sheetTitle = "Filters",
  sheetFilters,
  activeFilterCount = 0,
  showFilterTrigger = true,
  searchSlot,
  activeFilters,
  toolbarEnd,
  LensNav: LensNavComponent,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const filterPanelId = useId();
  const LensNav = LensNavComponent ?? CatalogSegmentNav;
  const hasLenses = lenses != null && lenses.length > 0 && activeLensId != null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {hasLenses ? (
          <LensNav items={lenses} activeId={activeLensId} aria-label={lensAriaLabel} />
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {searchSlot ? (
            <div
              className={cn(
                "min-w-0 flex-1 lg:max-w-md",
                showFilterTrigger ? "hidden lg:block" : "block w-full",
              )}
            >
              {renderSearchSlot(searchSlot, "toolbar")}
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
          {toolbarEnd}
        </div>
      </div>
      {searchSlot && showFilterTrigger ? (
        <div className="lg:hidden">{renderSearchSlot(searchSlot, "mobile")}</div>
      ) : null}
      {activeFilters}
      {showFilterTrigger && sheetFilters ? (
        <SplitFilterSheet
          open={open}
          onOpenChange={setOpen}
          title={sheetTitle}
          description="Refine results. Filter changes apply when you navigate."
        >
          <div id={filterPanelId} className="space-y-4">
            {searchSlot ? (
              <div className="lg:hidden">{renderSearchSlot(searchSlot, "sheet")}</div>
            ) : null}
            {sheetFilters}
          </div>
        </SplitFilterSheet>
      ) : null}
    </div>
  );
}
