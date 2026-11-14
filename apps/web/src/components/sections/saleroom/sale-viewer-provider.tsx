"use client";

import { fetchSaleViewer } from "@/lib/marketing/fetch-sale-viewer.client";
import { SIGNED_OUT_SALE_VIEWER, type SaleViewerVM } from "@/lib/marketing/sale-viewer";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

const SaleViewerContext = createContext<SaleViewerVM>(SIGNED_OUT_SALE_VIEWER);

/**
 * The person looking at a sale page (CO-7). The page is rendered once, signed out, for everyone;
 * this island asks `/api/sales/:id/me` who is looking and hands the answer to the parts that
 * depend on it (follow, watch, register, telephone). Until it answers, and when it cannot, those
 * parts read as signed out, exactly as the cached HTML drew them.
 */
export function SaleViewerProvider({ saleId, children }: { saleId: string; children: ReactNode }) {
  const [viewer, setViewer] = useState<SaleViewerVM>(SIGNED_OUT_SALE_VIEWER);

  useEffect(() => {
    let cancelled = false;
    fetchSaleViewer(saleId)
      .then((next) => {
        if (!cancelled && next) setViewer(next);
      })
      .catch(() => {
        // Stays signed out: the public page still works.
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  return <SaleViewerContext.Provider value={viewer}>{children}</SaleViewerContext.Provider>;
}

export function useSaleViewer(): SaleViewerVM {
  return useContext(SaleViewerContext);
}
