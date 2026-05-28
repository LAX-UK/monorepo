"use client";

import { useCallback, useEffect, useState } from "react";

type UseFilterSheetDraftOptions<D> = {
  mobileOpen: boolean;
  desktopOpen: boolean;
  fromFilters: () => D;
  defaultDraft: D;
};

/** Syncs filter-sheet draft state when sheets close and exposes reset to defaults. */
export function useFilterSheetDraft<D>({
  mobileOpen,
  desktopOpen,
  fromFilters,
  defaultDraft,
}: UseFilterSheetDraftOptions<D>) {
  const [draft, setDraft] = useState(defaultDraft);

  useEffect(() => {
    if (!mobileOpen && !desktopOpen) {
      setDraft(fromFilters());
    }
  }, [desktopOpen, fromFilters, mobileOpen]);

  const resetDraft = useCallback(() => {
    setDraft(defaultDraft);
  }, [defaultDraft]);

  return { draft, setDraft, resetDraft };
}
