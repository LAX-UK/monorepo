"use client";

import { persistDashboardDensityCookieAction } from "@/lib/actions/dashboard-density";
import { type DashboardDensity, createLocalStorageDensityStore } from "@/lib/preferences/density";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const DensityContext = createContext<{
  density: DashboardDensity;
  setDensity: (density: DashboardDensity) => void;
  toggleDensity: () => void;
} | null>(null);

export type DashboardTableDensity = "comfortable" | "compact";

export function DensityProvider({
  children,
  cookieDensity,
}: {
  children: ReactNode;
  /** Server-read preference so density survives refresh across devices when cookie is set. */
  cookieDensity?: DashboardDensity | null;
}) {
  const [density, setDensityState] = useState<DashboardDensity>("normal");

  useEffect(() => {
    const store = createLocalStorageDensityStore();
    const saved = cookieDensity ?? store.getDensity();
    setDensityState(saved);
    document.documentElement.dataset.dashboardDensity = saved;
  }, [cookieDensity]);

  const setDensity = useCallback((next: DashboardDensity) => {
    setDensityState(next);
    createLocalStorageDensityStore().setDensity(next);
    document.documentElement.dataset.dashboardDensity = next;
    void persistDashboardDensityCookieAction(next);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === "compact" ? "normal" : "compact");
  }, [density, setDensity]);

  const value = useMemo(
    () => ({ density, setDensity, toggleDensity }),
    [density, setDensity, toggleDensity],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDashboardDensity(): {
  density: DashboardDensity;
  setDensity: (density: DashboardDensity) => void;
} {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    return {
      density: "normal",
      setDensity: () => {},
    };
  }
  return { density: ctx.density, setDensity: ctx.setDensity };
}

export function useTableDensity(): {
  density: DashboardTableDensity;
  setDensity: (density: DashboardTableDensity) => void;
} {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    return {
      density: "comfortable",
      setDensity: () => {},
    };
  }
  return {
    density: ctx.density === "compact" ? "compact" : "comfortable",
    setDensity: (density) => ctx.setDensity(density === "compact" ? "compact" : "normal"),
  };
}

export function useDensityToggle() {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    return {
      density: "normal" as DashboardDensity,
      toggleDensity: () => {},
    };
  }
  return { density: ctx.density, toggleDensity: ctx.toggleDensity };
}
