import type { LotPageViewer } from "@/lib/lot-page/lot-page-viewer";

/** Reads the caller's part of the lot page; null when it cannot be read (the page stays signed out). */
export async function fetchLotPageViewer(lotId: string): Promise<LotPageViewer | null> {
  const res = await fetch(`/api/lots/${encodeURIComponent(lotId)}/me`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: LotPageViewer };
  return body.data ?? null;
}
