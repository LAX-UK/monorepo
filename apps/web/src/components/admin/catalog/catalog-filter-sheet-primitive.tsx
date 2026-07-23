"use client";

import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { SplitFilterSheet } from "@/components/ui/split-filter-sheet";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { type ReactNode, cloneElement, isValidElement, useId, useState } from "react";

export const CATALOG_FILTER_SHEET_DESCRIPTION = "Refine results, then apply to update the list.";

export type CatalogFilterSheetState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  hydrated: boolean;
  filterPanelId: string;
};

export function useCatalogFilterSheetState(): CatalogFilterSheetState {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const filterPanelId = useId();
  return { open, setOpen, hydrated, filterPanelId };
}

type SearchSlotProps = { inputId?: string; paramName?: string };

export function searchInputIdFor(
  baseId: string,
  placement: "toolbar" | "mobile" | "sheet",
): string {
  return `${baseId}-${placement}`;
}

/** Clone search slot with placement-specific input id (sticky bar custom search nodes). */
export function renderAdminSearchSlot(
  slot: ReactNode,
  placement: "toolbar" | "mobile" | "sheet",
): ReactNode {
  if (!slot) return null;
  if (!isValidElement<SearchSlotProps>(slot)) return slot;
  const base = slot.props.inputId ?? `admin-list-search-${slot.props.paramName ?? "q"}`;
  return cloneElement<SearchSlotProps>(slot, { inputId: searchInputIdFor(base, placement) });
}

type TriggerProps = {
  activeCount: number;
} & Pick<CatalogFilterSheetState, "open" | "setOpen" | "hydrated" | "filterPanelId">;

export function CatalogFilterSheetTrigger({
  open,
  setOpen,
  hydrated,
  filterPanelId,
  activeCount,
}: TriggerProps) {
  return (
    <MarketingFilterTrigger
      onClick={() => setOpen(true)}
      activeCount={activeCount}
      aria-expanded={open}
      {...(hydrated ? { "aria-controls": filterPanelId } : {})}
    />
  );
}

type PanelProps = {
  title: string;
  children: ReactNode;
  description?: string;
  onApply?: () => void;
  onReset?: () => void;
  applyDisabled?: boolean;
  applyDisabledHint?: string;
  applyLabel?: string;
  resetLabel?: string;
} & Pick<CatalogFilterSheetState, "open" | "setOpen" | "hydrated" | "filterPanelId">;

export function CatalogFilterSheetPanel({
  open,
  setOpen,
  hydrated,
  filterPanelId,
  title,
  children,
  description = CATALOG_FILTER_SHEET_DESCRIPTION,
  onApply,
  onReset,
  applyDisabled,
  applyDisabledHint,
  applyLabel = "Apply filters",
  resetLabel = "Reset",
}: PanelProps) {
  return (
    <SplitFilterSheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      {...(onApply ? { onApply } : {})}
      {...(onReset ? { onReset } : {})}
      {...(applyDisabled != null ? { applyDisabled } : {})}
      {...(applyDisabledHint ? { applyDisabledHint } : {})}
      applyLabel={applyLabel}
      resetLabel={resetLabel}
    >
      <div {...(hydrated ? { id: filterPanelId } : {})}>{children}</div>
    </SplitFilterSheet>
  );
}
