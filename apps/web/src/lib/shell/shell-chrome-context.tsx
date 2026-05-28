"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ShellChromeContextValue = {
  hideBottomTabBar: boolean;
  setHideBottomTabBar: (hide: boolean) => void;
  mobileTitleOverride: string | null;
  setMobileTitleOverride: (title: string | null) => void;
};

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [hideBottomTabBar, setHideBottomTabBarState] = useState(false);
  const [mobileTitleOverride, setMobileTitleOverrideState] = useState<string | null>(null);
  const setHideBottomTabBar = useCallback((hide: boolean) => {
    setHideBottomTabBarState(hide);
  }, []);
  const setMobileTitleOverride = useCallback((title: string | null) => {
    setMobileTitleOverrideState(title);
  }, []);

  const value = useMemo(
    () => ({
      hideBottomTabBar,
      setHideBottomTabBar,
      mobileTitleOverride,
      setMobileTitleOverride,
    }),
    [hideBottomTabBar, setHideBottomTabBar, mobileTitleOverride, setMobileTitleOverride],
  );

  return <ShellChromeContext.Provider value={value}>{children}</ShellChromeContext.Provider>;
}

export function useShellChrome(): ShellChromeContextValue {
  const ctx = useContext(ShellChromeContext);
  if (!ctx) {
    throw new Error("useShellChrome must be used within ShellChromeProvider");
  }
  return ctx;
}

/** Hides the mobile bottom tab bar while mounted (focused wizard flows). */
export function HideBottomTabBarWhileMounted() {
  const { setHideBottomTabBar } = useShellChrome();
  useEffect(() => {
    setHideBottomTabBar(true);
    return () => setHideBottomTabBar(false);
  }, [setHideBottomTabBar]);
  return null;
}
