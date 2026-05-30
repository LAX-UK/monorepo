"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { type ReactNode, createContext, useContext } from "react";

type SaleDetailReadinessContextValue = {
  draftSetupReadiness: CatalogReadinessResult | null;
  deleteBlockers: readonly string[];
  canManageSales: boolean;
};

const SaleDetailReadinessContext = createContext<SaleDetailReadinessContextValue | null>(null);

type ProviderProps = {
  draftSetupReadiness: CatalogReadinessResult | null;
  deleteBlockers?: readonly string[];
  canManageSales?: boolean;
  children: ReactNode;
};

export function SaleDetailReadinessProvider({
  draftSetupReadiness,
  deleteBlockers = [],
  canManageSales = false,
  children,
}: ProviderProps) {
  return (
    <SaleDetailReadinessContext.Provider
      value={{ draftSetupReadiness, deleteBlockers, canManageSales }}
    >
      {children}
    </SaleDetailReadinessContext.Provider>
  );
}

export function useSaleDetailReadiness(): SaleDetailReadinessContextValue | null {
  return useContext(SaleDetailReadinessContext);
}
