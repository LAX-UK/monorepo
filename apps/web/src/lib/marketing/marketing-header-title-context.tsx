"use client";

import { type ReactNode, createContext, useContext, useMemo, useState } from "react";

type MarketingHeaderTitleState = {
  title: string | null;
  setTitle: (title: string | null) => void;
};

const MarketingHeaderTitleContext = createContext<MarketingHeaderTitleState | null>(null);

export function MarketingHeaderTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return (
    <MarketingHeaderTitleContext.Provider value={value}>
      {children}
    </MarketingHeaderTitleContext.Provider>
  );
}

export function useMarketingHeaderTitle(): MarketingHeaderTitleState {
  const ctx = useContext(MarketingHeaderTitleContext);
  if (!ctx) {
    return {
      title: null,
      setTitle: () => {},
    };
  }
  return ctx;
}
