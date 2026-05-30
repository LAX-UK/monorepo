"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { type ReactNode, createContext, useContext } from "react";

type SaleDetailReadinessContextValue = {
  draftSetupReadiness: CatalogReadinessResult | null;
};

const SaleDetailReadinessContext = createContext<SaleDetailReadinessContextValue | null>(null);

type ProviderProps = {
  draftSetupReadiness: CatalogReadinessResult | null;
  children: ReactNode;
};

export function SaleDetailReadinessProvider({ draftSetupReadiness, children }: ProviderProps) {
  return (
    <SaleDetailReadinessContext.Provider value={{ draftSetupReadiness }}>
      {children}
    </SaleDetailReadinessContext.Provider>
  );
}

export function useSaleDetailReadiness(): SaleDetailReadinessContextValue | null {
  return useContext(SaleDetailReadinessContext);
}
