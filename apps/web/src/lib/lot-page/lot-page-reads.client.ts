import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { type LotViewerView, parseLotViewerView } from "@/lib/lot-page/lot-viewer";
import type { PublicBidHistory } from "@auction/domain";
import { parsePublicBidHistory } from "./public-bid-history-parse";

async function readData(path: string): Promise<unknown | null> {
  try {
    const res = await browserFetch(`${browserApiBase()}${path}`);
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isIndexableObject(body) ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

/** Where the signed-in viewer stands on a lot; `null` when it could not be read. */
export async function fetchLotViewer(lotId: string): Promise<LotViewerView | null> {
  const data = await readData(`/lots/${encodeURIComponent(lotId)}/me`);
  return data === null ? null : parseLotViewerView(data);
}

/** The anonymised bid history: amount, channel and time, newest first. */
export async function fetchPublicBidHistory(
  lotId: string,
  limit: number,
): Promise<PublicBidHistory | null> {
  const data = await readData(`/lots/${encodeURIComponent(lotId)}/bid-history?limit=${limit}`);
  return data === null ? null : parsePublicBidHistory(data);
}
