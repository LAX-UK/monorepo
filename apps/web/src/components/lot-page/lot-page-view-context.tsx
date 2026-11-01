"use client";

import type { LotPageView } from "@/lib/lot-page/build-lot-page-view";
import { type LotPageViewSource, useLotPageView } from "@/lib/lot-page/use-lot-page-view";
import type { PublicBidHistory } from "@auction/domain";
import { type ReactNode, createContext, useContext } from "react";

type LotPageViewContextValue = {
  view: LotPageView;
  history: PublicBidHistory | null;
  /** The server-corrected clock, in ms, for relative times. */
  nowMs: number;
};

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
  const { view, history, nowMs } = useLotPageView(source);
  return (
    <LotPageViewContext.Provider value={{ view, history, nowMs }}>
      {children}
    </LotPageViewContext.Provider>
  );
}

export function useLotPageViewContext(): LotPageViewContextValue {
  const ctx = useContext(LotPageViewContext);
  if (!ctx) throw new Error("useLotPageViewContext must be used within LotPageViewProvider");
  return ctx;
}
