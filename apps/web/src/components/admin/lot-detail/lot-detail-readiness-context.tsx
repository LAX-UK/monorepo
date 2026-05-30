"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { type ReactNode, createContext, useContext } from "react";

type LotDetailReadinessContextValue = {
  publishReadiness: CatalogReadinessResult | null;
};

const LotDetailReadinessContext = createContext<LotDetailReadinessContextValue | null>(null);

type ProviderProps = {
  publishReadiness: CatalogReadinessResult | null;
  children: ReactNode;
};

export function LotDetailReadinessProvider({ publishReadiness, children }: ProviderProps) {
  return (
    <LotDetailReadinessContext.Provider value={{ publishReadiness }}>
      {children}
    </LotDetailReadinessContext.Provider>
  );
}

export function useLotDetailReadiness(): LotDetailReadinessContextValue | null {
  return useContext(LotDetailReadinessContext);
}
