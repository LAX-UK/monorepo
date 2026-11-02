"use client";

import type { LotPageView } from "@/lib/lot-page/build-lot-page-view";
import { NO_LOT_VIEWER } from "@/lib/lot-page/lot-viewer";
import {
  type LotPageLive,
  type LotPageViewSource,
  useLotPageView,
} from "@/lib/lot-page/use-lot-page-view";
import { type ReactNode, createContext, useContext } from "react";

/** The lot's live view, plus the server-corrected clock (`nowMs`) for relative times. */
type LotPageViewContextValue = LotPageLive;

const LotPageViewContext = createContext<LotPageViewContextValue | null>(null);

/**
 * Computes the lot's view once and shares it with every part of the template, so the badge, the
 * price block and the history can never disagree about what the lot is doing.
 */
export function LotPageViewProvider({
  source,
  children,
}: {
  source: LotPageViewSource;
  children: ReactNode;
}) {
  const live = useLotPageView(source);
  return <LotPageViewContext.Provider value={live}>{children}</LotPageViewContext.Provider>;
}

export function useLotPageViewContext(): LotPageViewContextValue {
  const ctx = useContext(LotPageViewContext);
  if (!ctx) throw new Error("useLotPageViewContext must be used within LotPageViewProvider");
  return ctx;
}

/**
 * A lot page that draws a view which never changes (a withdrawn lot has no clock, no price and no
 * bidding), so it needs none of the live providers.
 */
export function LotPageViewStaticProvider({
  view,
  children,
}: {
  view: LotPageView;
  children: ReactNode;
}) {
  return (
    <LotPageViewContext.Provider
      value={{
        view,
        history: null,
        nowMs: 0,
        currentPrice: "0",
        nextBid: null,
        viewer: NO_LOT_VIEWER,
      }}
    >
      {children}
    </LotPageViewContext.Provider>
  );
}
