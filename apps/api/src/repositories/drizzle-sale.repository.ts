import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { lot, payment, sale, saleCategories } from "@auction/db/schema";
import type { CreateSaleInput, Sale, SaleStatus } from "@auction/types";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { mapSaleRow } from "../lib/mappers.js";
import type { ISaleRepository, ListSalesFilter } from "../services/interfaces/repositories.js";

/** Sold lot without captured/refunded buyer payment. */
function soldLotMissingSettledPayment() {
  return sql`exists (
    select 1 from ${lot} l
    where l.sale_id = ${sale.id}
      and l.deleted_at is null
      and l.status = 'ended'
      and l.winner_id is not null
      and not exists (
        select 1 from ${payment} p
        where p.lot_id = l.id
          and p.status in ('captured', 'refunded')
      )
  )`;
}

function listWhere(input: Omit<ListSalesFilter, "limit" | "offset" | "sort">) {
  const conditions = [saleNotDeleted()];
  if (input.statuses?.length) conditions.push(inArray(sale.status, input.statuses));
  else if (input.status) conditions.push(eq(sale.status, input.status));
  const categoryIds = input.categoryIds?.length
    ? input.categoryIds
    : input.categoryId
      ? [input.categoryId]
      : [];
  if (categoryIds.length > 0) {
    conditions.push(sql`exists (
      select 1 from ${saleCategories}
      where ${saleCategories.saleId} = ${sale.id}
        and ${saleCategories.categoryId} in (${sql.join(
          categoryIds.map((categoryId) => sql`${categoryId}`),
          sql`, `,
        )})
    )`);
  }
  const q = input.q?.trim();
  if (q) {
    const safe = q.replace(/[%_\\]/g, "");
    if (safe.length > 0) {
      conditions.push(ilike(sale.title, `%${safe}%`));
    }
  }
  if (input.deliveryMode) conditions.push(eq(sale.deliveryMode, input.deliveryMode));
  if (input.settlementStatus === "settled") {
    conditions.push(sql`not ${soldLotMissingSettledPayment()}`);
  } else if (input.settlementStatus === "unsettled") {
    conditions.push(soldLotMissingSettledPayment());
  }
  if (input.needsSetup) {
    conditions.push(eq(sale.status, "draft"));
    conditions.push(
      sql`(
        not exists (
          select 1 from ${lot} l
          where l.sale_id = ${sale.id}
            and l.deleted_at is null
        )
        or (
          ${sale.deliveryMode} = 'onsite'
          and coalesce(nullif(trim(${sale.locationName}), ''), nullif(trim(${sale.locationCity}), '')) is null
        )
      )`,
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export class DrizzleSaleRepository implements ISaleRepository {
  constructor(private readonly db: Database) {}

  private async categoryIdsBySaleIds(ids: string[]): Promise<Map<string, string[]>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ saleId: saleCategories.saleId, categoryId: saleCategories.categoryId })
      .from(saleCategories)
      .where(inArray(saleCategories.saleId, ids))
      .orderBy(asc(saleCategories.sortOrder));
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const arr = map.get(row.saleId) ?? [];
      arr.push(row.categoryId);
      map.set(row.saleId, arr);
    }
    return map;
  }

  private async withCategoryIds(rows: (typeof sale.$inferSelect)[]): Promise<Sale[]> {
    const categoriesBySale = await this.categoryIdsBySaleIds(rows.map((row) => row.id));
    return rows.map((row) => mapSaleRow(row, categoriesBySale.get(row.id) ?? []));
  }

  async findById(id: string): Promise<Sale | null> {
    const rows = await this.db
      .select()
      .from(sale)
      .where(and(eq(sale.id, id), saleNotDeleted()))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const categories = await this.categoryIdsBySaleIds([row.id]);
    return mapSaleRow(row, categories.get(row.id) ?? []);
  }

  async findByIds(ids: string[]): Promise<Sale[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(sale)
      .where(and(inArray(sale.id, ids), saleNotDeleted()));
    const categories = await this.categoryIdsBySaleIds(rows.map((r) => r.id));
    return rows.map((r) => mapSaleRow(r, categories.get(r.id) ?? []));
  }

  async create(input: CreateSaleInput): Promise<Sale> {
    const coverImages = input.coverImages ?? [];
    const categoryIds = input.categoryIds ?? (input.categoryId ? [input.categoryId] : []);
    if (!input.createdByLegalEntityId) {
      throw new Error("created_by_legal_entity_id_required");
    }
    const createdByLegalEntityId = input.createdByLegalEntityId;

    const row = await this.db.transaction(async (tx) => {
      const values: typeof sale.$inferInsert = {
        title: input.title,
        description: input.description ?? null,
        coverImages,
        deliveryMode: input.deliveryMode ?? "onsite",
        streamUrl: input.streamUrl ?? null,
        locationName: input.locationName ?? null,
        locationAddress: input.locationAddress ?? null,
        locationMapUrl: input.locationMapUrl ?? null,
        locationAddressLine1: input.locationAddressLine1 ?? null,
        locationAddressLine2: input.locationAddressLine2 ?? null,
        locationCity: input.locationCity ?? null,
        locationCounty: input.locationCounty ?? null,
        locationPostcode: input.locationPostcode ?? null,
        locationCountry: input.locationCountry ?? null,
        venueId: input.venueId ?? null,
        startTime: input.startTime,
        endTime: input.endTime,
        previewStartTime: input.previewStartTime ?? null,
        terms: input.terms ?? null,
        createdByLegalEntityId,
        status: "draft",
      };
      if (input.buyerPremiumRate !== undefined) {
        values.buyerPremiumRate = input.buyerPremiumRate;
      }
      if (input.buyerPremiumTiers !== undefined) {
        values.buyerPremiumTiers = input.buyerPremiumTiers ?? null;
      }
      const [created] = await tx.insert(sale).values(values).returning();
      if (!created) throw new Error("Failed to create sale");
      if (categoryIds.length > 0) {
        await tx.insert(saleCategories).values(
          categoryIds.map((categoryId, index) => ({
            saleId: created.id,
            categoryId,
            sortOrder: index,
          })),
        );
      }
      return created;
    });
    return mapSaleRow(row, categoryIds);
  }

  async list(filter: ListSalesFilter): Promise<Sale[]> {
    const whereClause = listWhere(filter);
    const order = filter.sort === "startAsc" ? asc(sale.startTime) : desc(sale.createdAt);
    const rows = await this.db
      .select()
      .from(sale)
      .where(whereClause)
      .orderBy(order)
      .limit(filter.limit)
      .offset(filter.offset);
    return this.withCategoryIds(rows);
  }

  async countMatching(filter: Omit<ListSalesFilter, "limit" | "offset" | "sort">): Promise<number> {
    const whereClause = listWhere(filter);
    const [row] = await (whereClause
      ? this.db.select({ n: sql<number>`count(*)::int` }).from(sale).where(whereClause)
      : this.db.select({ n: sql<number>`count(*)::int` }).from(sale));
    return row?.n ?? 0;
  }

  async findWithStatuses(statuses: SaleStatus[]): Promise<Sale[]> {
    if (statuses.length === 0) return [];
    const rows = await this.db
      .select()
      .from(sale)
      .where(and(inArray(sale.status, statuses), saleNotDeleted()));
    return this.withCategoryIds(rows);
  }

  async update(id: string, patch: Partial<CreateSaleInput>): Promise<Sale> {
    const rowPatch: Partial<typeof sale.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) rowPatch.title = patch.title;
    if (patch.description !== undefined) rowPatch.description = patch.description ?? null;
    if (patch.coverImages !== undefined) rowPatch.coverImages = patch.coverImages;
    const categoryIds =
      patch.categoryIds !== undefined
        ? patch.categoryIds
        : patch.categoryId
          ? [patch.categoryId]
          : undefined;
    if (patch.startTime !== undefined) rowPatch.startTime = patch.startTime;
    if (patch.endTime !== undefined) rowPatch.endTime = patch.endTime;
    if (patch.previewStartTime !== undefined)
      rowPatch.previewStartTime = patch.previewStartTime ?? null;
    if (patch.buyerPremiumRate !== undefined) rowPatch.buyerPremiumRate = patch.buyerPremiumRate;
    if (patch.buyerPremiumTiers !== undefined)
      rowPatch.buyerPremiumTiers = patch.buyerPremiumTiers ?? null;
    if (patch.terms !== undefined) rowPatch.terms = patch.terms ?? null;
    if (patch.deliveryMode !== undefined) rowPatch.deliveryMode = patch.deliveryMode;
    if (patch.streamUrl !== undefined) rowPatch.streamUrl = patch.streamUrl;
    if (patch.locationName !== undefined) rowPatch.locationName = patch.locationName ?? null;
    if (patch.locationAddress !== undefined)
      rowPatch.locationAddress = patch.locationAddress ?? null;
    if (patch.locationMapUrl !== undefined) rowPatch.locationMapUrl = patch.locationMapUrl ?? null;
    if (patch.locationAddressLine1 !== undefined)
      rowPatch.locationAddressLine1 = patch.locationAddressLine1 ?? null;
    if (patch.locationAddressLine2 !== undefined)
      rowPatch.locationAddressLine2 = patch.locationAddressLine2 ?? null;
    if (patch.locationCity !== undefined) rowPatch.locationCity = patch.locationCity ?? null;
    if (patch.locationCounty !== undefined) rowPatch.locationCounty = patch.locationCounty ?? null;
    if (patch.locationPostcode !== undefined)
      rowPatch.locationPostcode = patch.locationPostcode ?? null;
    if (patch.locationCountry !== undefined)
      rowPatch.locationCountry = patch.locationCountry ?? null;
    if (patch.venueId !== undefined) rowPatch.venueId = patch.venueId ?? null;

    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(sale)
        .set(rowPatch)
        .where(and(eq(sale.id, id), saleNotDeleted()))
        .returning();
      if (!updated) throw new Error("Sale update failed");
      if (categoryIds !== undefined) {
        await tx.delete(saleCategories).where(eq(saleCategories.saleId, id));
        if (categoryIds.length > 0) {
          await tx.insert(saleCategories).values(
            categoryIds.map((categoryId, index) => ({
              saleId: id,
              categoryId,
              sortOrder: index,
            })),
          );
        }
      }
      return updated;
    });
    const categories = await this.categoryIdsBySaleIds([row.id]);
    return mapSaleRow(row, categories.get(row.id) ?? []);
  }

  async updateStatus(id: string, status: Sale["status"]): Promise<void> {
    await this.db.update(sale).set({ status, updatedAt: new Date() }).where(eq(sale.id, id));
  }
}
