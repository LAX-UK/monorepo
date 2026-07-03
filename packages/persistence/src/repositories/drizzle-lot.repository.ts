import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { artistProfile, bid, legalEntity, lot, lotCategories } from "@auction/db/schema";
import type { CreateLotInput, Lot } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  ArchiveEndedAggregateFilter,
  ILotRepository,
  ListCatalogLotsBySalePageInput,
  ListLotsFilter,
} from "../interfaces/index.js";
import { mapLotRow } from "../lib/entity-row-mappers.js";
import { mergeLotMarketingDetailsPatch } from "../lib/lot-marketing-details-merge.js";
import {
  countLotsCreatedAtByDay,
  countMatchingLots,
  sumEndedLotHammer,
} from "./lot/lot-analytics-queries.js";
import {
  countLotsBySaleIds,
  findLotsBySaleId,
  findLotsBySaleIds,
  findPreviewLotsBySaleIds,
  listCatalogLotsBySalePage,
} from "./lot/lot-catalog-queries.js";
import { mapLotWithCategories, mapLotsWithCategories } from "./lot/lot-category-queries.js";
import {
  findActiveDutchLots,
  findActiveLotsByEndTimeBetween,
  findActiveLotsPastEnd,
  findScheduledLotsToActivate,
  listSoldLotIdsMissingPayment,
  markArchivedSellerOnDraftScheduledLots,
} from "./lot/lot-lifecycle-queries.js";
import { type ListWhereInput, listOrderBy, listWhere } from "./lot/lot-list-filters.js";

export class DrizzleLotRepository implements ILotRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.id, id), lotNotDeleted()))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return mapLotWithCategories(this.db, row);
  }

  async findByIds(ids: string[]): Promise<Lot[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(lot)
      .where(and(inArray(lot.id, ids), lotNotDeleted()));
    return mapLotsWithCategories(this.db, rows);
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
    return mapLotWithCategories(this.db, row);
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
          ...(input.autoBidEnabled !== undefined ? { autoBidEnabled: input.autoBidEnabled } : {}),
          ...(input.autoBidStepMin !== undefined ? { autoBidStepMin: input.autoBidStepMin } : {}),
          ...(input.autoBidStepMax !== undefined ? { autoBidStepMax: input.autoBidStepMax } : {}),
          ...(input.autoBidStepPresets !== undefined
            ? { autoBidStepPresets: input.autoBidStepPresets }
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
          marketingDetails: input.marketingDetails ?? {},
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
      return mapLotsWithCategories(
        this.db,
        rows.map((r) => r.lotRow),
      );
    }

    const orderBy = listOrderBy(filter.sort);

    const rows = await this.db
      .select()
      .from(lot)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(filter.limit)
      .offset(filter.offset);

    return mapLotsWithCategories(this.db, rows);
  }

  async countMatching(filter: ListWhereInput): Promise<number> {
    return countMatchingLots(this.db, filter);
  }

  async sumEndedHammer(
    filter: ArchiveEndedAggregateFilter,
  ): Promise<{ total: string; count: number }> {
    return sumEndedLotHammer(this.db, filter);
  }

  async findScheduledToActivate(asOf: Date): Promise<Lot[]> {
    return findScheduledLotsToActivate(this.db, asOf);
  }

  async findActivePastEnd(asOf: Date): Promise<Lot[]> {
    return findActiveLotsPastEnd(this.db, asOf);
  }

  async findActiveByEndTimeBetween(endAfter: Date, endBeforeInclusive: Date): Promise<Lot[]> {
    return findActiveLotsByEndTimeBetween(this.db, endAfter, endBeforeInclusive);
  }

  async findActiveDutchLots(): Promise<Lot[]> {
    return findActiveDutchLots(this.db);
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
    return markArchivedSellerOnDraftScheduledLots(this.db, sellerLegalEntityId);
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
    if (input.autoBidEnabled !== undefined) patch.autoBidEnabled = input.autoBidEnabled;
    if (input.autoBidStepMin !== undefined) patch.autoBidStepMin = input.autoBidStepMin ?? null;
    if (input.autoBidStepMax !== undefined) patch.autoBidStepMax = input.autoBidStepMax ?? null;
    if (input.autoBidStepPresets !== undefined)
      patch.autoBidStepPresets = input.autoBidStepPresets ?? null;
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
    return mapLotWithCategories(this.db, row);
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
    return mapLotWithCategories(this.db, row);
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
    return findLotsBySaleId(this.db, saleId);
  }

  async findBySaleIds(saleIds: string[]): Promise<Lot[]> {
    return findLotsBySaleIds(this.db, saleIds);
  }

  async countLotsBySaleIds(
    saleIds: string[],
    options?: { publicOnly?: boolean | undefined },
  ): Promise<Map<string, number>> {
    return countLotsBySaleIds(this.db, saleIds, options);
  }

  async findPreviewLotsBySaleIds(
    saleIds: string[],
    limitPerSale: number,
    options?: { publicOnly?: boolean | undefined },
  ): Promise<Lot[]> {
    return findPreviewLotsBySaleIds(this.db, saleIds, limitPerSale, options);
  }

  async listCatalogLotsBySalePage(
    input: ListCatalogLotsBySalePageInput,
  ): Promise<{ items: Lot[]; total: number }> {
    return listCatalogLotsBySalePage(this.db, input);
  }

  async countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>> {
    return countLotsCreatedAtByDay(this.db, rangeStart);
  }

  async listSoldLotsMissingPayment(limit: number): Promise<string[]> {
    return listSoldLotIdsMissingPayment(this.db, limit);
  }
}
