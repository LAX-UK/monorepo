import type { Database } from "@auction/db";
import { bid } from "@auction/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { mapBidRow } from "../lib/mappers.js";
import type { CreateBidRow, IBidRepository } from "../services/interfaces/repositories.js";

export class DrizzleBidRepository implements IBidRepository {
  constructor(private readonly db: Database) {}

  async create(row: CreateBidRow) {
    const [created] = await this.db
      .insert(bid)
      .values({
        lotId: row.lotId,
        bidderId: row.bidderId,
        amount: row.amount,
        isWinning: row.isWinning,
        isAutoBid: row.isAutoBid,
        maxAutoBidAmount: row.maxAutoBidAmount,
      })
      .returning();
    if (!created) throw new Error("Failed to create bid");
    return mapBidRow(created);
  }

  async findHighestForLot(lotId: string) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.amount))
      .limit(1);
    const row = rows[0];
    return row ? mapBidRow(row) : null;
  }

  async listForLot(lotId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async listForLotSettlement(lotId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.amount), asc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async findWinningBid(lotId: string) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(and(eq(bid.lotId, lotId), eq(bid.isWinning, true)))
      .limit(1);
    const row = rows[0];
    return row ? mapBidRow(row) : null;
  }

  async listDistinctBidderIds(lotId: string) {
    const rows = await this.db
      .selectDistinct({ bidderId: bid.bidderId })
      .from(bid)
      .where(eq(bid.lotId, lotId));
    return rows.map((r) => r.bidderId);
  }

  async listForBidder(bidderId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.bidderId, bidderId))
      .orderBy(desc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async markWinningBid(lotId: string, bidId: string) {
    await this.db.update(bid).set({ isWinning: false }).where(eq(bid.lotId, lotId));
    await this.db.update(bid).set({ isWinning: true }).where(eq(bid.id, bidId));
  }
}
