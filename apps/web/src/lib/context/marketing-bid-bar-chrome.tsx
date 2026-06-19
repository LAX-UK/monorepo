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

type MarketingBidBarChromeContextValue = {
  /** When false, bottom chrome skips bid-bar height on marketing bid-bar routes. */
  active: boolean | undefined;
  setActive: (active: boolean | undefined) => void;
};

const MarketingBidBarChromeContext = createContext<MarketingBidBarChromeContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
  /** SSR hint for lot pages — avoids a flash of bid-bar bottom padding on terminal lots. */
  initialActive?: boolean;
};

export function MarketingBidBarChromeProvider({ children, initialActive }: ProviderProps) {
  const [active, setActiveState] = useState<boolean | undefined>(initialActive);

  const setActive = useCallback((next: boolean | undefined) => {
    setActiveState(next);
  }, []);

  const value = useMemo(() => ({ active, setActive }), [active, setActive]);

  return (
    <MarketingBidBarChromeContext.Provider value={value}>
      {children}
    </MarketingBidBarChromeContext.Provider>
  );
}

export function useMarketingBidBarChromeActive(): boolean | undefined {
  return useContext(MarketingBidBarChromeContext)?.active;
}

/** Sync sticky bar mount state into bottom-chrome padding (lot bid bar, etc.). */
export function useMarketingBidBarChromeRegistration(active: boolean) {
  const ctx = useContext(MarketingBidBarChromeContext);
  const setActive = ctx?.setActive;

  useEffect(() => {
    if (!setActive) return;
    setActive(active);
    return () => setActive(undefined);
  }, [active, setActive]);
}
