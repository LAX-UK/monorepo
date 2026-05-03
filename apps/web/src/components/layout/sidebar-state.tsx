"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SidebarState = "expanded" | "collapsed";

const STORAGE_KEY = "lax_sidebar_collapsed";

const SidebarStateContext = createContext<{
  state: SidebarState;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
} | null>(null);

function readStoredState(): SidebarState {
  if (typeof window === "undefined") return "expanded";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

function writeStoredState(collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    /* ignore quota / private mode */
  }
}

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SidebarState>("expanded");

  useEffect(() => {
    setState(readStoredState());
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setState(collapsed ? "collapsed" : "expanded");
    writeStoredState(collapsed);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(state !== "collapsed");
  }, [setCollapsed, state]);

  const value = useMemo(
    () => ({
      state,
      collapsed: state === "collapsed",
      setCollapsed,
      toggleCollapsed,
    }),
    [setCollapsed, state, toggleCollapsed],
  );

  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
}

export function useSidebarState() {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) {
    return {
      state: "expanded" as SidebarState,
      collapsed: false,
      setCollapsed: () => {},
      toggleCollapsed: () => {},
    };
  }
  return ctx;
}
