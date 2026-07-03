import type { Database } from "@auction/db";
import { bid, lot } from "@auction/db/schema";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { IPaddleBidWindowReader } from "../interfaces/paddle-bid-window.reader.js";

const SELF_SERVICE_BID_WINDOW_MS = 30 * 60_000;

export class DrizzlePaddleBidWindowReader implements IPaddleBidWindowReader {
  constructor(private readonly db: Database) {}

  async hasRecentSelfServiceBid(saleId: string, userId: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - SELF_SERVICE_BID_WINDOW_MS);
    const rows = await this.db
      .select({ id: bid.id })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(lot.saleId, saleId),
          eq(bid.bidderId, userId),
          or(eq(bid.placedVia, "web"), isNull(bid.placedVia)),
          gt(bid.createdAt, cutoff),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
}
