"use client";

import { fetchLotPageViewer } from "@/lib/lot-page/fetch-lot-page-viewer.client";
import type { LotPageViewer } from "@/lib/lot-page/lot-page-viewer";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

const LotPageViewerContext = createContext<LotPageViewer | null>(null);

/**
 * The person looking at a lot page (CO-7). The page is rendered once, signed out, for everyone;
 * `signedOut` is what that render used. This island asks `/api/lots/:id/me` who is looking and
 * hands the answer to the parts that depend on it. Until it answers, and when it cannot, they
 * read as signed out, exactly as the cached HTML drew them, so nobody can bid before the gate
 * knows who they are.
 */
export function LotPageViewerProvider({
  lotId,
  signedOut,
  children,
}: {
  lotId: string;
  signedOut: LotPageViewer;
  children: ReactNode;
}) {
  const [viewer, setViewer] = useState<LotPageViewer>(signedOut);

  useEffect(() => {
    let cancelled = false;
    fetchLotPageViewer(lotId)
      .then((next) => {
        if (!cancelled && next) setViewer(next);
      })
      .catch(() => {
        // Stays signed out: the public page still works.
      });
    return () => {
      cancelled = true;
    };
  }, [lotId]);

  return <LotPageViewerContext.Provider value={viewer}>{children}</LotPageViewerContext.Provider>;
}

/** The person looking, or null outside a lot page (the withdrawn page, tests). */
export function useLotPageViewerOptional(): LotPageViewer | null {
  return useContext(LotPageViewerContext);
}
