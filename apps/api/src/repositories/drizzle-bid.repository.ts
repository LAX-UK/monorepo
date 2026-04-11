import type { Database } from "@auction/db";
import { bid } from "@auction/db/schema";
import { desc, eq } from "drizzle-orm";
import { mapBidRow } from "../lib/mappers.js";
import type { CreateBidRow, IBidRepository } from "../services/interfaces/repositories.js";

export class DrizzleBidRepository implements IBidRepository {
  constructor(private readonly db: Database) {}

  async create(row: CreateBidRow) {
    const [created] = await this.db
      .insert(bid)
      .values({
        auctionId: row.auctionId,
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

  async findHighestForAuction(auctionId: string) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.auctionId, auctionId))
      .orderBy(desc(bid.amount))
      .limit(1);
    const row = rows[0];
    return row ? mapBidRow(row) : null;
  }

  async listForAuction(auctionId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.auctionId, auctionId))
      .orderBy(desc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async markWinningBid(auctionId: string, bidId: string) {
    await this.db.update(bid).set({ isWinning: false }).where(eq(bid.auctionId, auctionId));
    await this.db.update(bid).set({ isWinning: true }).where(eq(bid.id, bidId));
  }
}
