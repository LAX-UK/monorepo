import { getBrowserHcLive } from "@/lib/data/http/hc-browser";
import { parseLotBiddingView } from "@/lib/lot-page/lot-bidding-view";
import type { Lot, PublicLotView } from "@auction/types";

export type LotBidSnapshot = Pick<Lot, "currentPrice" | "endTime" | "status" | "winnerId"> & {
  /** Present for public-view lots when a reserve is configured; undefined for staff lots. */
  reserveMet?: boolean;
  /** Whether an ended lot sold, and whether its result is final yet. */
  hasWinner?: boolean;
  resultPending?: boolean;
  /** The sold lot's public prices, once there are any. */
  hammerPrice?: string | null;
  soldForWithPremium?: string | null;
  /** The API's clock when it answered (ISO), so the countdown starts from a live reading. */
  serverNow?: string | null;
};

/**
 * Refetch public lot fields after a websocket reconnect (stale price guard). The lot schema (Zod)
 * is fetched alongside the request, so it is not in the first scripts of lot and sale pages; a
 * failed fetch of it reads as a failed refetch.
 */
export async function fetchLotBidSnapshot(lotId: string): Promise<LotBidSnapshot | null> {
  const lotSchema = import("@/lib/data/http/lot.schema");
  lotSchema.catch(() => {
    // Reported through the await below.
  });
  try {
    // No-store: the live read is never answered from a cache (CO-7); it is what corrects the page.
    const res = await getBrowserHcLive().lots[":id"].$get({ param: { id: lotId } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: unknown };
    const { parsePublicLotViewSchema } = await lotSchema;
    const lot = parsePublicLotViewSchema(body.data) as Lot | PublicLotView;
    const base: LotBidSnapshot = {
      currentPrice: lot.currentPrice,
      endTime: lot.endTime,
      status: lot.status,
      winnerId: lot.winnerId,
    };
    if ("reserveMet" in lot && typeof (lot as PublicLotView).reserveMet === "boolean") {
      base.reserveMet = (lot as PublicLotView).reserveMet as boolean;
    }
    if (typeof lot.hasWinner === "boolean") base.hasWinner = lot.hasWinner;
    if (lot.resultPending) base.resultPending = true;
    const bidding = parseLotBiddingView(body.data);
    base.hammerPrice = bidding.hammerPrice;
    base.soldForWithPremium = bidding.soldForWithPremium;
    base.serverNow = bidding.serverNow;
    return base;
  } catch {
    return null;
  }
}
