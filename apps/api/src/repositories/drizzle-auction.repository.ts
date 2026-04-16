import type { Database } from "@auction/db";
import { auction } from "@auction/db/schema";
import type { Auction, CreateAuctionInput } from "@auction/types";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { mapAuctionRow } from "../lib/mappers.js";
import type {
  ArchiveEndedAggregateFilter,
  IAuctionRepository,
  ListAuctionsFilter,
  ListAuctionsSort,
} from "../services/interfaces/repositories.js";

type ListWhereInput = Omit<ListAuctionsFilter, "limit" | "offset" | "sort">;

function endYearBoundsUtc(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function listWhere(input: ListWhereInput) {
  const conditions = [];
  if (input.status) conditions.push(eq(auction.status, input.status));
  if (input.categoryId) conditions.push(eq(auction.categoryId, input.categoryId));
  if (input.sellerId) conditions.push(eq(auction.sellerId, input.sellerId));
  if (input.winnerId) conditions.push(eq(auction.winnerId, input.winnerId));
  if (input.endYear !== undefined) {
    const { start, end } = endYearBoundsUtc(input.endYear);
    conditions.push(gte(auction.endTime, start));
    conditions.push(lt(auction.endTime, end));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function listOrderBy(sort: ListAuctionsSort | undefined) {
  switch (sort) {
    case "endingAsc":
      return asc(auction.endTime);
    case "hammerDesc":
      return desc(auction.currentPrice);
    case "endedDesc":
      return desc(auction.endTime);
    default:
      return desc(auction.createdAt);
  }
}

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
        medium: input.medium ?? null,
        dimensions: input.dimensions ?? null,
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
        ...(input.minBidIncrement !== undefined ? { minBidIncrement: input.minBidIncrement } : {}),
        ...(input.dutchDecrementAmount !== undefined ? { dutchDecrementAmount: input.dutchDecrementAmount } : {}),
        ...(input.dutchDecrementIntervalMs !== undefined
          ? { dutchDecrementIntervalMs: input.dutchDecrementIntervalMs }
          : {}),
      })
      .returning();
    if (!row) throw new Error("Failed to create auction");
    return mapAuctionRow(row);
  }

  async list(filter: ListAuctionsFilter) {
    const whereClause = listWhere(filter);
    const orderBy = listOrderBy(filter.sort);

    const rows = await this.db
      .select()
      .from(auction)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(filter.limit)
      .offset(filter.offset);

    return rows.map(mapAuctionRow);
  }

  async countMatching(filter: ListWhereInput): Promise<number> {
    const whereClause = listWhere(filter);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(auction)
      .where(whereClause);
    return row?.n ?? 0;
  }

  async sumEndedHammer(filter: ArchiveEndedAggregateFilter): Promise<{ total: string; count: number }> {
    const conditions = [eq(auction.status, "ended")];
    if (filter.endYear !== undefined) {
      const { start, end } = endYearBoundsUtc(filter.endYear);
      conditions.push(gte(auction.endTime, start));
      conditions.push(lt(auction.endTime, end));
    }
    const whereClause = and(...conditions);
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${auction.currentPrice}), 0)::text`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(auction)
      .where(whereClause);
    return {
      total: row?.total ?? "0",
      count: row?.cnt ?? 0,
    };
  }

  async findScheduledToActivate(asOf: Date): Promise<Auction[]> {
    const rows = await this.db
      .select()
      .from(auction)
      .where(and(eq(auction.status, "scheduled"), lte(auction.startTime, asOf)));
    return rows.map(mapAuctionRow);
  }

  async findActivePastEnd(asOf: Date): Promise<Auction[]> {
    const rows = await this.db
      .select()
      .from(auction)
      .where(and(eq(auction.status, "active"), lte(auction.endTime, asOf)));
    return rows.map(mapAuctionRow);
  }

  async findActiveDutchAuctions(): Promise<Auction[]> {
    const rows = await this.db
      .select()
      .from(auction)
      .where(and(eq(auction.status, "active"), eq(auction.auctionType, "dutch")));
    return rows.map(mapAuctionRow);
  }

  async setDutchLastDecrementAt(id: string, at: Date | null): Promise<void> {
    await this.db
      .update(auction)
      .set({ dutchLastDecrementAt: at, updatedAt: new Date() })
      .where(eq(auction.id, id));
  }

  async updateDutchCurrentPrice(id: string, price: string, lastDecrementAt: Date): Promise<void> {
    await this.db
      .update(auction)
      .set({
        currentPrice: price,
        dutchLastDecrementAt: lastDecrementAt,
        updatedAt: new Date(),
      })
      .where(eq(auction.id, id));
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

  async update(id: string, input: Partial<CreateAuctionInput>): Promise<Auction> {
    const patch: Partial<typeof auction.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.medium !== undefined) patch.medium = input.medium ?? null;
    if (input.dimensions !== undefined) patch.dimensions = input.dimensions ?? null;
    if (input.images !== undefined) patch.images = input.images;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId ?? null;
    if (input.auctionType !== undefined) patch.auctionType = input.auctionType;
    if (input.startingPrice !== undefined) {
      patch.startingPrice = input.startingPrice;
      patch.currentPrice = input.startingPrice;
    }
    if (input.reservePrice !== undefined) patch.reservePrice = input.reservePrice ?? null;
    if (input.buyNowPrice !== undefined) patch.buyNowPrice = input.buyNowPrice ?? null;
    if (input.buyerPremiumRate !== undefined) patch.buyerPremiumRate = input.buyerPremiumRate;
    if (input.minBidIncrement !== undefined) patch.minBidIncrement = input.minBidIncrement;
    if (input.dutchDecrementAmount !== undefined) patch.dutchDecrementAmount = input.dutchDecrementAmount ?? null;
    if (input.dutchDecrementIntervalMs !== undefined) patch.dutchDecrementIntervalMs = input.dutchDecrementIntervalMs;
    if (input.startTime !== undefined) patch.startTime = input.startTime;
    if (input.endTime !== undefined) patch.endTime = input.endTime;

    const [row] = await this.db.update(auction).set(patch).where(eq(auction.id, id)).returning();
    if (!row) throw new Error("Auction update failed");
    return mapAuctionRow(row);
  }

  async setWinner(id: string, winnerId: string) {
    await this.db
      .update(auction)
      .set({ winnerId, updatedAt: new Date() })
      .where(eq(auction.id, id));
  }
}
