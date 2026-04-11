import type { Database } from "@auction/db";
import { auction } from "@auction/db/schema";
import type { Auction, CreateAuctionInput } from "@auction/types";
import { and, desc, eq } from "drizzle-orm";
import { mapAuctionRow } from "../lib/mappers.js";
import type {
  IAuctionRepository,
  ListAuctionsFilter,
} from "../services/interfaces/repositories.js";

export class DrizzleAuctionRepository implements IAuctionRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const rows = await this.db.select().from(auction).where(eq(auction.id, id)).limit(1);
    const row = rows[0];
    return row ? mapAuctionRow(row) : null;
  }

  async findByIdForUpdate(id: string) {
    const rows = await this.db
      .select()
      .from(auction)
      .where(eq(auction.id, id))
      .for("update")
      .limit(1);
    const row = rows[0];
    return row ? mapAuctionRow(row) : null;
  }

  async create(sellerId: string, input: CreateAuctionInput) {
    const images = input.images ?? [];
    const [row] = await this.db
      .insert(auction)
      .values({
        sellerId,
        title: input.title,
        description: input.description ?? null,
        images,
        categoryId: input.categoryId ?? null,
        auctionType: input.auctionType,
        startingPrice: input.startingPrice,
        reservePrice: input.reservePrice ?? null,
        buyNowPrice: input.buyNowPrice ?? null,
        currentPrice: input.startingPrice,
        ...(input.buyerPremiumRate !== undefined
          ? { buyerPremiumRate: input.buyerPremiumRate }
          : {}),
        startTime: input.startTime,
        endTime: input.endTime,
        status: "draft",
      })
      .returning();
    if (!row) throw new Error("Failed to create auction");
    return mapAuctionRow(row);
  }

  async list(filter: ListAuctionsFilter) {
    const conditions = [];
    if (filter.status) conditions.push(eq(auction.status, filter.status));
    if (filter.categoryId) conditions.push(eq(auction.categoryId, filter.categoryId));
    if (filter.sellerId) conditions.push(eq(auction.sellerId, filter.sellerId));
    if (filter.winnerId) conditions.push(eq(auction.winnerId, filter.winnerId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(auction)
      .where(whereClause)
      .orderBy(desc(auction.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);

    return rows.map(mapAuctionRow);
  }

  async updateCurrentPrice(id: string, price: string) {
    await this.db
      .update(auction)
      .set({ currentPrice: price, updatedAt: new Date() })
      .where(eq(auction.id, id));
  }

  async updateEndTime(id: string, endTime: Date) {
    await this.db.update(auction).set({ endTime, updatedAt: new Date() }).where(eq(auction.id, id));
  }

  async updateStatus(id: string, status: Auction["status"]) {
    await this.db.update(auction).set({ status, updatedAt: new Date() }).where(eq(auction.id, id));
  }

  async setWinner(id: string, winnerId: string) {
    await this.db
      .update(auction)
      .set({ winnerId, updatedAt: new Date() })
      .where(eq(auction.id, id));
  }
}
