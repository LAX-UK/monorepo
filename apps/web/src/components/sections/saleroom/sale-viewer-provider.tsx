"use client";

import { fetchSaleViewer } from "@/lib/marketing/fetch-sale-viewer.client";
import type { SaleViewerVM } from "@/lib/marketing/sale-viewer";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

const SaleViewerContext = createContext<SaleViewerVM | null>(null);
/** False until `/me` has answered (or failed): until then the viewer is only the signed-out guess. */
const SaleViewerLoadedContext = createContext(false);

/**
 * The person looking at a sale page (CO-7). The page is rendered once, signed out, for everyone;
 * this island asks `/api/sales/:id/me` who is looking and hands the answer to the parts that
 * depend on it (follow, watch, register, telephone). Until it answers, and when it cannot, those
 * parts read as signed out, exactly as the cached HTML drew them.
 */
export function SaleViewerProvider({
  saleId,
  signedOut,
  children,
}: {
  saleId: string;
  /** `SIGNED_OUT_SALE_VIEWER`, passed from the server so the browser bundle does not build it. */
  signedOut: SaleViewerVM;
  children: ReactNode;
}) {
  const [viewer, setViewer] = useState<SaleViewerVM>(signedOut);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSaleViewer(saleId)
      .then((next) => {
        if (cancelled) return;
        if (next) setViewer(next);
        setLoaded(true);
      })
      .catch(() => {
        // Stays signed out: the public page still works.
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  return (
    <SaleViewerContext.Provider value={viewer}>
      <SaleViewerLoadedContext.Provider value={loaded}>{children}</SaleViewerLoadedContext.Provider>
    </SaleViewerContext.Provider>
  );
}

export function useSaleViewer(): SaleViewerVM {
  const viewer = useContext(SaleViewerContext);
  if (!viewer) throw new Error("useSaleViewer must be used within SaleViewerProvider");
  return viewer;
}

/** Whether the viewer is the person's real answer from `/me`, not the signed-out first render. */
export function useSaleViewerLoaded(): boolean {
  return useContext(SaleViewerLoadedContext);
}
