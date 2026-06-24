import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseLotDetail } from "@/lib/data/http/parse";
import type { Lot, PublicLotView } from "@auction/types";

export type LotBidSnapshot = Pick<Lot, "currentPrice" | "endTime" | "status" | "winnerId"> & {
  /** Present for public-view lots when a reserve is configured; undefined for staff lots. */
  reserveMet?: boolean;
};

/** Refetch public lot fields after a websocket reconnect (stale price guard). */
export async function fetchLotBidSnapshot(lotId: string): Promise<LotBidSnapshot | null> {
  try {
    const res = await getBrowserHc().lots[":id"].$get({ param: { id: lotId } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: unknown };
    const lot = parseLotDetail(body.data) as Lot | PublicLotView;
    const base: LotBidSnapshot = {
      currentPrice: lot.currentPrice,
      endTime: lot.endTime,
      status: lot.status,
      winnerId: lot.winnerId,
    };
    if ("reserveMet" in lot && typeof (lot as PublicLotView).reserveMet === "boolean") {
      base.reserveMet = (lot as PublicLotView).reserveMet as boolean;
    }
    return base;
  } catch {
    return null;
  }
}
