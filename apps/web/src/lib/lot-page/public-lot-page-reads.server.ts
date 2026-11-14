import "server-only";

import {
  getPublicBidHistory,
  getPublicLotBiddingView,
} from "@/lib/data/http/public-catalogue.server";
import type { LotBiddingView } from "@/lib/lot-page/lot-bidding-view";
import type { LotViewerView } from "@/lib/lot-page/lot-viewer";
import type { PublicBidHistory } from "@auction/domain";

/**
 * What the lot template reads beyond the lot, as everyone sees it (CO-7): the bidding fields and
 * the anonymised history. The viewer's standing is not read here; the browser reads it once
 * `/api/lots/:id/me` says who is looking, and marks "you" in the history itself.
 */
export async function loadPublicLotTemplateReads(lotId: string): Promise<{
  bidding: LotBiddingView;
  history: PublicBidHistory | null;
  viewer: LotViewerView | null;
}> {
  const [bidding, history] = await Promise.all([
    getPublicLotBiddingView(lotId),
    getPublicBidHistory(lotId),
  ]);
  return { bidding, history, viewer: null };
}
