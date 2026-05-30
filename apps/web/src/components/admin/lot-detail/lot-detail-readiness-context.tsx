"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { type ReactNode, createContext, useContext } from "react";

type LotDetailReadinessContextValue = {
  publishReadiness: CatalogReadinessResult | null;
  deleteBlockers: readonly string[];
  canManageAuction: boolean;
};

const LotDetailReadinessContext = createContext<LotDetailReadinessContextValue | null>(null);

type ProviderProps = {
  publishReadiness: CatalogReadinessResult | null;
  deleteBlockers?: readonly string[];
  canManageAuction?: boolean;
  children: ReactNode;
};

export function LotDetailReadinessProvider({
  publishReadiness,
  deleteBlockers = [],
  canManageAuction = false,
  children,
}: ProviderProps) {
  return (
    <LotDetailReadinessContext.Provider
      value={{ publishReadiness, deleteBlockers, canManageAuction }}
    >
      {children}
    </LotDetailReadinessContext.Provider>
  );
}

export function useLotDetailReadiness(): LotDetailReadinessContextValue | null {
  return useContext(LotDetailReadinessContext);
}
