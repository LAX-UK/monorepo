import type { Database } from "@auction/db";
import { lot, user } from "@auction/db/schema";
import type { CreateLotInput, Lot } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, lte, sql } from "drizzle-orm";
import { mergeLotMarketingDetailsPatch } from "../lib/lot-marketing-details-merge.js";
import { mapLotRow } from "../lib/mappers.js";
import type {
  ArchiveEndedAggregateFilter,
  ILotRepository,
  ListLotsFilter,
  ListLotsSort,
} from "../services/interfaces/repositories.js";

type ListWhereInput = Omit<ListLotsFilter, "limit" | "offset" | "sort">;

function endYearBoundsUtc(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

function listWhere(input: ListWhereInput) {
  const conditions = [];
  if (input.status) conditions.push(eq(lot.status, input.status));
  if (input.categoryId) conditions.push(eq(lot.categoryId, input.categoryId));
  if (input.sellerId) conditions.push(eq(lot.sellerId, input.sellerId));
  if (input.winnerId) conditions.push(eq(lot.winnerId, input.winnerId));
  if (input.saleId) conditions.push(eq(lot.saleId, input.saleId));
  if (input.endYear !== undefined) {
    const { start, end } = endYearBoundsUtc(input.endYear);
    conditions.push(gte(lot.endTime, start));
    conditions.push(lt(lot.endTime, end));
  }
  if (input.search?.trim()) {
    const safe = input.search.trim().slice(0, 200).replace(/[%_\\]/g, "");
    if (safe.length > 0) {
      conditions.push(ilike(lot.title, `%${safe}%`));
    }
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function listOrderBy(sort: ListLotsSort | undefined) {
  switch (sort) {
    case "endingAsc":
      return asc(lot.endTime);
    case "hammerDesc":
      return desc(lot.currentPrice);
    case "endedDesc":
      return desc(lot.endTime);
    default:
      return desc(lot.createdAt);
  }
}

export class DrizzleLotRepository implements ILotRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const rows = await this.db.select().from(lot).where(eq(lot.id, id)).limit(1);
    const row = rows[0];
    return row ? mapLotRow(row) : null;
  }

  async findByIdForUpdate(id: string) {
    const rows = await this.db.select().from(lot).where(eq(lot.id, id)).for("update").limit(1);
    const row = rows[0];
    return row ? mapLotRow(row) : null;
  }

  async create(sellerId: string, input: CreateLotInput) {
    const images = input.images ?? [];
    const [row] = await this.db
      .insert(lot)
      .values({
        sellerId,
        title: input.title,
        description: input.description ?? null,
        medium: input.medium ?? null,
        dimensions: input.dimensions ?? null,
        images,
        categoryId: input.categoryId,
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
        ...(input.dutchDecrementAmount !== undefined
          ? { dutchDecrementAmount: input.dutchDecrementAmount }
          : {}),
        ...(input.dutchDecrementIntervalMs !== undefined
          ? { dutchDecrementIntervalMs: input.dutchDecrementIntervalMs }
          : {}),
        ...(input.saleId !== undefined && input.saleId !== null ? { saleId: input.saleId } : {}),
        ...(input.lotNumber !== undefined && input.lotNumber !== null
          ? { lotNumber: input.lotNumber }
          : {}),
        marketingDetails: {},
      })
      .returning();
    if (!row) throw new Error("Failed to create lot");
    return mapLotRow(row);
  }

  async list(filter: ListLotsFilter) {
    const whereClause = listWhere(filter);

    if (filter.sort === "sellerAsc") {
      const rows = await this.db
        .select({ lotRow: lot })
        .from(lot)
        .innerJoin(user, eq(lot.sellerId, user.id))
        .where(whereClause)
        .orderBy(asc(user.name), desc(lot.endTime))
        .limit(filter.limit)
        .offset(filter.offset);
      return rows.map((r) => mapLotRow(r.lotRow));
    }

    const orderBy = listOrderBy(filter.sort);

    const rows = await this.db
      .select()
      .from(lot)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(filter.limit)
      .offset(filter.offset);

    return rows.map(mapLotRow);
  }

  async countMatching(filter: ListWhereInput): Promise<number> {
    const whereClause = listWhere(filter);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .where(whereClause);
    return row?.n ?? 0;
  }

  async sumEndedHammer(
    filter: ArchiveEndedAggregateFilter,
  ): Promise<{ total: string; count: number }> {
    const conditions = [eq(lot.status, "ended")];
    if (filter.endYear !== undefined) {
      const { start, end } = endYearBoundsUtc(filter.endYear);
      conditions.push(gte(lot.endTime, start));
      conditions.push(lt(lot.endTime, end));
    }
    const whereClause = and(...conditions);
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${lot.currentPrice}), 0)::text`,
        cnt: sql<number>`count(*)::int`,
      })
      .from(lot)
      .where(whereClause);
    return {
      total: row?.total ?? "0",
      count: row?.cnt ?? 0,
    };
  }

  async findScheduledToActivate(asOf: Date): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.status, "scheduled"), lte(lot.startTime, asOf)));
    return rows.map(mapLotRow);
  }

  async findActivePastEnd(asOf: Date): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.status, "active"), lte(lot.endTime, asOf)));
    return rows.map(mapLotRow);
  }

  async findActiveByEndTimeBetween(endAfter: Date, endBeforeInclusive: Date): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(
        and(
          eq(lot.status, "active"),
          gt(lot.endTime, endAfter),
          lte(lot.endTime, endBeforeInclusive),
        ),
      );
    return rows.map(mapLotRow);
  }

  async findActiveDutchLots(): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.status, "active"), eq(lot.auctionType, "dutch")));
    return rows.map(mapLotRow);
  }

  async setDutchLastDecrementAt(id: string, at: Date | null): Promise<void> {
    await this.db
      .update(lot)
      .set({ dutchLastDecrementAt: at, updatedAt: new Date() })
      .where(eq(lot.id, id));
  }

  async updateDutchCurrentPrice(id: string, price: string, lastDecrementAt: Date): Promise<void> {
    await this.db
      .update(lot)
      .set({
        currentPrice: price,
        dutchLastDecrementAt: lastDecrementAt,
        updatedAt: new Date(),
      })
      .where(eq(lot.id, id));
  }

  /** Atomically decrement Dutch price only if `currentPrice` still matches `expectedPrice`. */
  async updateDutchCurrentPriceIfMatch(
    id: string,
    expectedPrice: string,
    nextPrice: string,
    lastDecrementAt: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .update(lot)
      .set({
        currentPrice: nextPrice,
        dutchLastDecrementAt: lastDecrementAt,
        updatedAt: new Date(),
      })
      .where(and(eq(lot.id, id), eq(lot.currentPrice, expectedPrice)))
      .returning({ id: lot.id });
    return rows.length > 0;
  }

  async updateCurrentPrice(id: string, price: string) {
    await this.db
      .update(lot)
      .set({ currentPrice: price, updatedAt: new Date() })
      .where(eq(lot.id, id));
  }

  async updateEndTime(id: string, endTime: Date) {
    await this.db.update(lot).set({ endTime, updatedAt: new Date() }).where(eq(lot.id, id));
  }

  async updateStatus(id: string, status: Lot["status"]) {
    await this.db.update(lot).set({ status, updatedAt: new Date() }).where(eq(lot.id, id));
  }

  async update(id: string, input: Partial<CreateLotInput>): Promise<Lot> {
    const patch: Partial<typeof lot.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.medium !== undefined) patch.medium = input.medium ?? null;
    if (input.dimensions !== undefined) patch.dimensions = input.dimensions ?? null;
    if (input.images !== undefined) patch.images = input.images;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.auctionType !== undefined) patch.auctionType = input.auctionType;
    if (input.startingPrice !== undefined) {
      patch.startingPrice = input.startingPrice;
      patch.currentPrice = input.startingPrice;
    }
    if (input.reservePrice !== undefined) patch.reservePrice = input.reservePrice ?? null;
    if (input.buyNowPrice !== undefined) patch.buyNowPrice = input.buyNowPrice ?? null;
    if (input.buyerPremiumRate !== undefined) patch.buyerPremiumRate = input.buyerPremiumRate;
    if (input.minBidIncrement !== undefined) patch.minBidIncrement = input.minBidIncrement;
    if (input.dutchDecrementAmount !== undefined)
      patch.dutchDecrementAmount = input.dutchDecrementAmount ?? null;
    if (input.dutchDecrementIntervalMs !== undefined)
      patch.dutchDecrementIntervalMs = input.dutchDecrementIntervalMs;
    if (input.startTime !== undefined) patch.startTime = input.startTime;
    if (input.endTime !== undefined) patch.endTime = input.endTime;
    if (input.saleId !== undefined) patch.saleId = input.saleId;
    if (input.lotNumber !== undefined) patch.lotNumber = input.lotNumber;

    const [row] = await this.db.update(lot).set(patch).where(eq(lot.id, id)).returning();
    if (!row) throw new Error("Lot update failed");
    return mapLotRow(row);
  }

  async updateMarketingDetails(id: string, patch: UpdateLotMarketingDetailsInput): Promise<Lot> {
    const current = await this.findById(id);
    if (!current) throw new Error("Lot not found");
    const next = mergeLotMarketingDetailsPatch(current.marketingDetails, patch);
    const [row] = await this.db
      .update(lot)
      .set({ marketingDetails: next, updatedAt: new Date() })
      .where(eq(lot.id, id))
      .returning();
    if (!row) throw new Error("Lot update failed");
    return mapLotRow(row);
  }

  async setWinner(id: string, winnerId: string) {
    await this.db.update(lot).set({ winnerId, updatedAt: new Date() }).where(eq(lot.id, id));
  }

  async clearSaleId(id: string): Promise<void> {
    await this.db
      .update(lot)
      .set({ saleId: null, lotNumber: null, updatedAt: new Date() })
      .where(eq(lot.id, id));
  }

  async findBySaleId(saleId: string): Promise<Lot[]> {
    const rows = await this.db.select().from(lot).where(eq(lot.saleId, saleId));
    return rows.map(mapLotRow);
  }

  async findBySaleIds(saleIds: string[]): Promise<Lot[]> {
    if (saleIds.length === 0) return [];
    const rows = await this.db.select().from(lot).where(inArray(lot.saleId, saleIds));
    return rows.map(mapLotRow);
  }
}
