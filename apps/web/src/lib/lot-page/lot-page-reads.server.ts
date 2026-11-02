import "server-only";

import { readJsonBody } from "@/lib/data/http/envelope";
import { getServerHc } from "@/lib/data/http/hc-server";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { PublicBidHistory } from "@auction/domain";
import { X_LEGAL_ENTITY_ID_HEADER } from "@auction/http-headers";
import { cache } from "react";
import {
  EMPTY_LOT_BIDDING_VIEW,
  type LotBiddingView,
  parseLotBiddingView,
} from "./lot-bidding-view";
import { type LotViewerView, parseLotViewerView } from "./lot-viewer";
import { LOT_HISTORY_LIMIT, parsePublicBidHistory } from "./public-bid-history-parse";

function dataOf(body: unknown): unknown {
  return isIndexableObject(body) ? body.data : undefined;
}

/**
 * The bidding fields of the lot detail response (server clock, next bid, sold prices). Read from
 * the same request as the lot, which the platform fetch layer shares within one render.
 */
export const getServerLotBiddingView = cache(async (lotId: string): Promise<LotBiddingView> => {
  try {
    const client = await getServerHc();
    const res = await client.lots[":id"].$get({ param: { id: lotId } });
    if (!res.ok) return EMPTY_LOT_BIDDING_VIEW;
    return parseLotBiddingView(dataOf(await readJsonBody(res)));
  } catch {
    return EMPTY_LOT_BIDDING_VIEW;
  }
});

/** The anonymised bid history, with "you" marked for a signed-in viewer. `null` on any failure. */
export const getServerPublicBidHistory = cache(
  async (lotId: string): Promise<PublicBidHistory | null> => {
    try {
      const client = await getServerHc();
      const res = await client.lots[":id"]["bid-history"].$get({
        param: { id: lotId },
        query: { limit: String(LOT_HISTORY_LIMIT) },
      });
      if (!res.ok) return null;
      return parsePublicBidHistory(dataOf(await readJsonBody(res)));
    } catch {
      return null;
    }
  },
);

/** Where the acting account stands on the lot, read for the first paint. `null` on any failure. */
export async function getServerLotViewer(
  lotId: string,
  actingEntityId: string | null,
): Promise<LotViewerView | null> {
  try {
    const client = await getServerHc();
    const res = await client.lots[":id"].me.$get(
      { param: { id: lotId } },
      actingEntityId ? { headers: { [X_LEGAL_ENTITY_ID_HEADER]: actingEntityId } } : undefined,
    );
    if (!res.ok) return null;
    return parseLotViewerView(dataOf(await readJsonBody(res)));
  } catch {
    return null;
  }
}

/** Everything the lot template reads beyond the lot, in parallel, each failing to its own default. */
export async function loadLotTemplateReads(input: {
  lotId: string;
  signedIn: boolean;
  actingEntityId: string | null;
}): Promise<{
  bidding: LotBiddingView;
  history: PublicBidHistory | null;
  viewer: LotViewerView | null;
}> {
  const [bidding, history, viewer] = await Promise.all([
    getServerLotBiddingView(input.lotId),
    getServerPublicBidHistory(input.lotId),
    input.signedIn ? getServerLotViewer(input.lotId, input.actingEntityId) : null,
  ]);
  return { bidding, history, viewer };
}
