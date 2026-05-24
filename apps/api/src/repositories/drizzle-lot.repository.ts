import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { artistProfile, bid, legalEntity, lot, lotCategories } from "@auction/db/schema";
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
  const conditions = [lotNotDeleted()];
  if (input.status) conditions.push(eq(lot.status, input.status));
  const categoryIds = input.categoryIds?.length
    ? input.categoryIds
    : input.categoryId
      ? [input.categoryId]
      : [];
  if (categoryIds.length > 0) {
    conditions.push(sql`exists (
      select 1 from ${lotCategories}
      where ${lotCategories.lotId} = ${lot.id}
        and ${lotCategories.categoryId} in (${sql.join(
          categoryIds.map((categoryId) => sql`${categoryId}`),
          sql`, `,
        )})
    )`);
  }
  if (input.sellerLegalEntityId)
    conditions.push(eq(lot.sellerLegalEntityId, input.sellerLegalEntityId));
  if (input.winnerId) conditions.push(eq(lot.winnerId, input.winnerId));
  if (input.saleId) conditions.push(eq(lot.saleId, input.saleId));
  if (input.artistId) conditions.push(eq(lot.artistId, input.artistId));
  if (input.endYear !== undefined) {
    const { start, end } = endYearBoundsUtc(input.endYear);
    conditions.push(gte(lot.endTime, start));
    conditions.push(lt(lot.endTime, end));
  }
  if (input.search?.trim()) {
    const safe = input.search
      .trim()
      .slice(0, 200)
      .replace(/[%_\\]/g, "");
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

  private async categoryIdsByLotIds(ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        lotId: lotCategories.lotId,
        categoryId: lotCategories.categoryId,
      })
      .from(lotCategories)
      .where(inArray(lotCategories.lotId, ids))
      .orderBy(asc(lotCategories.sortOrder));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const arr = map.get(row.lotId) ?? [];
      arr.push(row.categoryId);
      map.set(row.lotId, arr);
    }
    return map;
  }

  private async withCategoryIds<T extends typeof lot.$inferSelect>(rows: T[]): Promise<Lot[]> {
    const categoriesByLot = await this.categoryIdsByLotIds(rows.map((row) => row.id));
    return rows.map((row) => mapLotRow(row, categoriesByLot.get(row.id) ?? []));
  }

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.id, id), lotNotDeleted()))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const categories = await this.categoryIdsByLotIds([row.id]);
    return mapLotRow(row, categories.get(row.id) ?? []);
  }

  async findByIdForUpdate(id: string) {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.id, id), lotNotDeleted()))
      .for("update")
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const categories = await this.categoryIdsByLotIds([row.id]);
    return mapLotRow(row, categories.get(row.id) ?? []);
  }

  async create(input: CreateLotInput) {
    const images = input.images ?? [];
    const categoryIds = input.categoryIds ?? (input.categoryId ? [input.categoryId] : []);
    if (!input.sellerLegalEntityId) {
      throw new Error("seller_legal_entity_id_required");
    }
    const sellerLegalEntityId = input.sellerLegalEntityId;

    const row = await this.db.transaction(async (tx) => {
      // When an artist FK is supplied, the lot inherits a publish-gate flag if
      // the artist isn't approved yet. This keeps the catalogue consistent
      // when admins attach a freshly-created `pending` registry row.
      let artistReviewRequired = false;
      let artistId: string | null = null;
      if (input.artistId) {
        const [ap] = await tx
          .select({ status: artistProfile.status })
          .from(artistProfile)
          .where(eq(artistProfile.id, input.artistId))
          .limit(1);
        if (!ap) throw new Error("artist_not_found");
        artistId = input.artistId;
        artistReviewRequired = ap.status !== "approved";
      }

      const [created] = await tx
        .insert(lot)
        .values({
          sellerLegalEntityId,
          ...(artistId !== null ? { artistId, artistReviewRequired } : {}),
          title: input.title,
          description: input.description ?? null,
          medium: input.medium ?? null,
          dimensions: input.dimensions ?? null,
          images,
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
          ...(input.minBidIncrement !== undefined
            ? { minBidIncrement: input.minBidIncrement }
            : {}),
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
      if (!created) throw new Error("Failed to create lot");
      if (categoryIds.length > 0) {
        await tx.insert(lotCategories).values(
          categoryIds.map((categoryId, index) => ({
            lotId: created.id,
            categoryId,
            sortOrder: index,
          })),
        );
      }
      return created;
    });
    return mapLotRow(row, categoryIds);
  }

  async list(filter: ListLotsFilter) {
    const whereClause = listWhere(filter);

    if (filter.sort === "sellerAsc") {
      const rows = await this.db
        .select({ lotRow: lot })
        .from(lot)
        .innerJoin(legalEntity, eq(lot.sellerLegalEntityId, legalEntity.id))
        .where(whereClause)
        .orderBy(asc(legalEntity.displayName), desc(lot.endTime))
        .limit(filter.limit)
        .offset(filter.offset);
      return this.withCategoryIds(rows.map((r) => r.lotRow));
    }

    const orderBy = listOrderBy(filter.sort);

    const rows = await this.db
      .select()
      .from(lot)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(filter.limit)
      .offset(filter.offset);

    return this.withCategoryIds(rows);
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
    const conditions = [eq(lot.status, "ended"), lotNotDeleted()];
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
      .where(and(eq(lot.status, "scheduled"), lte(lot.startTime, asOf), lotNotDeleted()));
    return this.withCategoryIds(rows);
  }

  async findActivePastEnd(asOf: Date): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.status, "active"), lte(lot.endTime, asOf), lotNotDeleted()));
    return this.withCategoryIds(rows);
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
          lotNotDeleted(),
        ),
      );
    return this.withCategoryIds(rows);
  }

  async findActiveDutchLots(): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.status, "active"), eq(lot.auctionType, "dutch"), lotNotDeleted()));
    return this.withCategoryIds(rows);
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

  async voidLotAntiShillingClose(id: string): Promise<void> {
    await this.db.update(bid).set({ isWinning: false }).where(eq(bid.lotId, id));
    await this.db
      .update(lot)
      .set({
        status: "voided",
        voidedReason: "no_valid_winner",
        winnerId: null,
        buyerLegalEntityId: null,
        updatedAt: new Date(),
      })
      .where(eq(lot.id, id));
  }

  async markArchivedSellerOnDraftScheduledLots(sellerLegalEntityId: string): Promise<number> {
    const updated = await this.db
      .update(lot)
      .set({ archivedSeller: true, updatedAt: new Date() })
      .where(
        and(
          eq(lot.sellerLegalEntityId, sellerLegalEntityId),
          inArray(lot.status, ["draft", "scheduled"]),
          lotNotDeleted(),
        ),
      )
      .returning({ id: lot.id });
    return updated.length;
  }

  async update(id: string, input: Partial<CreateLotInput>): Promise<Lot> {
    const patch: Partial<typeof lot.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.medium !== undefined) patch.medium = input.medium ?? null;
    if (input.dimensions !== undefined) patch.dimensions = input.dimensions ?? null;
    if (input.sellerLegalEntityId !== undefined) {
      if (!input.sellerLegalEntityId) throw new Error("seller_legal_entity_id_required");
      patch.sellerLegalEntityId = input.sellerLegalEntityId;
    }
    if (input.images !== undefined) patch.images = input.images;
    const categoryIds =
      input.categoryIds !== undefined
        ? input.categoryIds
        : input.categoryId
          ? [input.categoryId]
          : undefined;
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

    const row = await this.db.transaction(async (tx) => {
      // Resolve the artist FK transition so that `artistReviewRequired` stays
      // in sync with the new artist's status. We keep this inside the same
      // transaction as the lot update for consistency.
      if (input.artistId !== undefined) {
        if (input.artistId === null) {
          patch.artistId = null;
          patch.artistReviewRequired = false;
        } else {
          const [ap] = await tx
            .select({ status: artistProfile.status })
            .from(artistProfile)
            .where(eq(artistProfile.id, input.artistId))
            .limit(1);
          if (!ap) throw new Error("artist_not_found");
          patch.artistId = input.artistId;
          patch.artistReviewRequired = ap.status !== "approved";
        }
      }

      const [updated] = await tx.update(lot).set(patch).where(eq(lot.id, id)).returning();
      if (!updated) throw new Error("Lot update failed");
      if (categoryIds !== undefined) {
        await tx.delete(lotCategories).where(eq(lotCategories.lotId, id));
        if (categoryIds.length > 0) {
          await tx.insert(lotCategories).values(
            categoryIds.map((categoryId, index) => ({
              lotId: id,
              categoryId,
              sortOrder: index,
            })),
          );
        }
      }
      return updated;
    });
    const categories = await this.categoryIdsByLotIds([row.id]);
    return mapLotRow(row, categories.get(row.id) ?? []);
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
    const categories = await this.categoryIdsByLotIds([row.id]);
    return mapLotRow(row, categories.get(row.id) ?? []);
  }

  async setWinner(id: string, winnerId: string, buyerLegalEntityId: string) {
    await this.db
      .update(lot)
      .set({ winnerId, buyerLegalEntityId, updatedAt: new Date() })
      .where(eq(lot.id, id));
  }

  async clearSaleId(id: string): Promise<void> {
    await this.db
      .update(lot)
      .set({ saleId: null, lotNumber: null, updatedAt: new Date() })
      .where(eq(lot.id, id));
  }

  async findBySaleId(saleId: string): Promise<Lot[]> {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.saleId, saleId), lotNotDeleted()));
    return this.withCategoryIds(rows);
  }

  async findBySaleIds(saleIds: string[]): Promise<Lot[]> {
    if (saleIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(inArray(lot.saleId, saleIds), lotNotDeleted()));
    return this.withCategoryIds(rows);
  }
}
