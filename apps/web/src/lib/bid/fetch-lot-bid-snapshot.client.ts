import { getBrowserHc } from "@/lib/data/http/hc-browser";
import type { Lot, PublicLotView } from "@auction/types";

export type LotBidSnapshot = Pick<Lot, "currentPrice" | "endTime" | "status" | "winnerId"> & {
  /** Present for public-view lots when a reserve is configured; undefined for staff lots. */
  reserveMet?: boolean;
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
    const res = await getBrowserHc().lots[":id"].$get({ param: { id: lotId } });
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
    return base;
  } catch {
    return null;
  }
}
