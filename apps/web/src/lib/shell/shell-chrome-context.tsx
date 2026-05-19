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
};

const ShellChromeContext = createContext<ShellChromeContextValue | null>(null);

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [hideBottomTabBar, setHideBottomTabBarState] = useState(false);
  const setHideBottomTabBar = useCallback((hide: boolean) => {
    setHideBottomTabBarState(hide);
  }, []);

  const value = useMemo(
    () => ({ hideBottomTabBar, setHideBottomTabBar }),
    [hideBottomTabBar, setHideBottomTabBar],
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
