import type { SaleViewerVM } from "@/lib/marketing/sale-viewer";

/** Reads the caller's part of the sale page; null when it cannot be read (the page stays signed out). */
export async function fetchSaleViewer(saleId: string): Promise<SaleViewerVM | null> {
  const res = await fetch(`/api/sales/${encodeURIComponent(saleId)}/me`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: SaleViewerVM };
  return body.data ?? null;
}
