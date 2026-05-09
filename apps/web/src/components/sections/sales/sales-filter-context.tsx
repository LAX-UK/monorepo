"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

type SalesFilterSheetContextValue = {
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (open: boolean) => void;
  openMobileFilters: () => void;
  closeMobileFilters: () => void;
};

const SalesFilterSheetContext = createContext<SalesFilterSheetContextValue | null>(null);

export function SalesFilterSheetProvider({ children }: { children: ReactNode }) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const openMobileFilters = useCallback(() => setMobileFiltersOpen(true), []);
  const closeMobileFilters = useCallback(() => setMobileFiltersOpen(false), []);

  const value = useMemo(
    () => ({
      mobileFiltersOpen,
      setMobileFiltersOpen,
      openMobileFilters,
      closeMobileFilters,
    }),
    [mobileFiltersOpen, openMobileFilters, closeMobileFilters],
  );

  return (
    <SalesFilterSheetContext.Provider value={value}>{children}</SalesFilterSheetContext.Provider>
  );
}

export function useSalesFilterSheet(): SalesFilterSheetContextValue {
  const ctx = useContext(SalesFilterSheetContext);
  if (!ctx) {
    throw new Error("useSalesFilterSheet must be used within SalesFilterSheetProvider");
  }
  return ctx;
}
