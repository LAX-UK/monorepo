import type { Database } from "@auction/db";
import { sale } from "@auction/db/schema";
import type { CreateSaleInput, Sale, SaleStatus } from "@auction/types";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { mapSaleRow } from "../lib/mappers.js";
import type { ISaleRepository, ListSalesFilter } from "../services/interfaces/repositories.js";

function listWhere(input: Omit<ListSalesFilter, "limit" | "offset" | "sort">) {
  const conditions = [];
  if (input.statuses?.length) conditions.push(inArray(sale.status, input.statuses));
  else if (input.status) conditions.push(eq(sale.status, input.status));
  if (input.categoryId) conditions.push(eq(sale.categoryId, input.categoryId));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export class DrizzleSaleRepository implements ISaleRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Sale | null> {
    const rows = await this.db.select().from(sale).where(eq(sale.id, id)).limit(1);
    const row = rows[0];
    return row ? mapSaleRow(row) : null;
  }

  async create(input: CreateSaleInput): Promise<Sale> {
    const coverImages = input.coverImages ?? [];
    const [row] = await this.db
      .insert(sale)
      .values({
        title: input.title,
        description: input.description ?? null,
        coverImages,
        categoryId: input.categoryId ?? null,
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
        startTime: input.startTime,
        endTime: input.endTime,
        previewStartTime: input.previewStartTime ?? null,
        ...(input.buyerPremiumRate !== undefined
          ? { buyerPremiumRate: input.buyerPremiumRate }
          : {}),
        terms: input.terms ?? null,
        createdBy: input.createdBy,
        status: "draft",
      })
      .returning();
    if (!row) throw new Error("Failed to create sale");
    return mapSaleRow(row);
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
    return rows.map(mapSaleRow);
  }

  async findWithStatuses(statuses: SaleStatus[]): Promise<Sale[]> {
    if (statuses.length === 0) return [];
    const rows = await this.db.select().from(sale).where(inArray(sale.status, statuses));
    return rows.map(mapSaleRow);
  }

  async update(id: string, patch: Partial<CreateSaleInput>): Promise<Sale> {
    const rowPatch: Partial<typeof sale.$inferInsert> = { updatedAt: new Date() };
    if (patch.title !== undefined) rowPatch.title = patch.title;
    if (patch.description !== undefined) rowPatch.description = patch.description ?? null;
    if (patch.coverImages !== undefined) rowPatch.coverImages = patch.coverImages;
    if (patch.categoryId !== undefined) rowPatch.categoryId = patch.categoryId ?? null;
    if (patch.startTime !== undefined) rowPatch.startTime = patch.startTime;
    if (patch.endTime !== undefined) rowPatch.endTime = patch.endTime;
    if (patch.previewStartTime !== undefined)
      rowPatch.previewStartTime = patch.previewStartTime ?? null;
    if (patch.buyerPremiumRate !== undefined) rowPatch.buyerPremiumRate = patch.buyerPremiumRate;
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

    const [row] = await this.db.update(sale).set(rowPatch).where(eq(sale.id, id)).returning();
    if (!row) throw new Error("Sale update failed");
    return mapSaleRow(row);
  }

  async updateStatus(id: string, status: Sale["status"]): Promise<void> {
    await this.db.update(sale).set({ status, updatedAt: new Date() }).where(eq(sale.id, id));
  }
}
