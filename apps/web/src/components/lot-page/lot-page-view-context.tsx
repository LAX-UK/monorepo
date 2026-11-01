"use client";

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
