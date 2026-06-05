import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseLot } from "@/lib/data/http/parse";
import type { Lot } from "@auction/types";

export type LotBidSnapshot = Pick<Lot, "currentPrice" | "endTime" | "status" | "winnerId">;

/** Refetch public lot fields after a websocket reconnect (stale price guard). */
export async function fetchLotBidSnapshot(lotId: string): Promise<LotBidSnapshot | null> {
  try {
    const res = await getBrowserHc().lots[":id"].$get({ param: { id: lotId } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: unknown };
    const lot = parseLot(body.data);
    return {
      currentPrice: lot.currentPrice,
      endTime: lot.endTime,
      status: lot.status,
      winnerId: lot.winnerId,
    };
  } catch {
    return null;
  }
}
