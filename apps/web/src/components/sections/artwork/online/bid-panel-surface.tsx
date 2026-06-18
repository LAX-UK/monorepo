"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

export type BidPanelSurface = "full" | "videoCompact";

const BidPanelSurfaceContext = createContext<BidPanelSurface>("full");

type Props = {
  surface: BidPanelSurface;
  children: ReactNode;
};

/**
 * Wraps the bid panel to communicate whether it should render its full card
 * or the compact bar shown under the video stream tab.
 */
export function BidPanelSurfaceProvider({ surface, children }: Props) {
  const value = useMemo(() => surface, [surface]);
  return (
    <BidPanelSurfaceContext.Provider value={value}>{children}</BidPanelSurfaceContext.Provider>
  );
}

/** Returns the current bid panel surface. Defaults to "full" outside a provider. */
export function useBidPanelSurface(): BidPanelSurface {
  return useContext(BidPanelSurfaceContext);
}
