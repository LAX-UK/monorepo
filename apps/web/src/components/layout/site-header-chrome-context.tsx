"use client";

import { type ReactNode, createContext, useContext } from "react";

export type SiteHeaderChromeValue = {
  /** True when the bar is visually over the marketing hero (transparent bar). */
  blendWithHero: boolean;
};

const SiteHeaderChromeContext = createContext<SiteHeaderChromeValue | null>(null);

export function SiteHeaderChromeProvider({
  value,
  children,
}: {
  value: SiteHeaderChromeValue;
  children: ReactNode;
}) {
  return (
    <SiteHeaderChromeContext.Provider value={value}>{children}</SiteHeaderChromeContext.Provider>
  );
}

/** Safe default when a child renders outside the marketing header (should not happen). */
export function useSiteHeaderChrome(): SiteHeaderChromeValue {
  return useContext(SiteHeaderChromeContext) ?? { blendWithHero: false };
}
