import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, lotCategories, lotLifecycleSnapshot, sale } from "@auction/db/schema";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { AdminLotBrowseInput } from "../services/admin/admin-lot-browse.service.js";
import type {
  AdminLotBrowseRawRow,
  IAdminLotBrowseReader,
} from "./interfaces/admin-lot-browse.reader.js";

function buildAttachableWhere(input: AdminLotBrowseInput) {
  const state = input.state ?? "available";
  const conditions = [
    lotNotDeleted(),
    eq(lot.status, "draft"),
    isNull(lot.saleId),
    eq(lot.archivedSeller, false),
  ];

  if (input.sellerLegalEntityId) {
    conditions.push(eq(lot.sellerLegalEntityId, input.sellerLegalEntityId));
  }
  if (input.artistId) {
    conditions.push(eq(lot.artistId, input.artistId));
  }
  if (input.excludeSaleId) {
    const excludeSaleCondition = or(
      isNull(lot.saleId),
      sql`${lot.saleId} <> ${input.excludeSaleId}`,
    );
    if (excludeSaleCondition) conditions.push(excludeSaleCondition);
  }
  if (input.q?.trim()) {
    const safe = input.q
      .trim()
      .slice(0, 200)
      .replace(/[%_\\]/g, "");
    if (safe.length > 0) conditions.push(ilike(lot.title, `%${safe}%`));
  }
  if (input.categoryIds?.length) {
    conditions.push(
      sql`exists (
          select 1 from ${lotCategories}
          where ${lotCategories.lotId} = ${lot.id}
            and ${lotCategories.categoryId} in (${sql.join(
              input.categoryIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        )`,
    );
  }

  if (state === "returned") {
    conditions.push(
      sql`${lotLifecycleSnapshot.returnedToInventoryAt} > now() - interval '90 days'`,
    );
  } else if (state === "available") {
    const availableCondition = or(
      isNull(lotLifecycleSnapshot.returnCount),
      eq(lotLifecycleSnapshot.returnCount, 0),
    );
    if (availableCondition) conditions.push(availableCondition);
  }

  return and(...conditions);
}

export class DrizzleAdminLotBrowseReader implements IAdminLotBrowseReader {
  constructor(private readonly db: Database) {}

  async countAttachable(input: AdminLotBrowseInput): Promise<number> {
    const where = buildAttachableWhere(input);
    const [countRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .leftJoin(lotLifecycleSnapshot, eq(lotLifecycleSnapshot.lotId, lot.id))
      .where(where);
    return countRow?.n ?? 0;
  }

  async listAttachableRows(input: AdminLotBrowseInput): Promise<AdminLotBrowseRawRow[]> {
    const where = buildAttachableWhere(input);
    return this.db
      .select({
        id: lot.id,
        title: lot.title,
        status: lot.status,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        saleId: lot.saleId,
        artistId: lot.artistId,
        createdAt: lot.createdAt,
        returnCount: lotLifecycleSnapshot.returnCount,
        returnedToInventoryAt: lotLifecycleSnapshot.returnedToInventoryAt,
        lastSaleId: lotLifecycleSnapshot.lastSaleId,
      })
      .from(lot)
      .leftJoin(lotLifecycleSnapshot, eq(lotLifecycleSnapshot.lotId, lot.id))
      .where(where)
      .orderBy(desc(lot.createdAt))
      .limit(input.limit)
      .offset(input.offset);
  }

  async findSaleTitlesByIds(saleIds: string[]): Promise<Map<string, string>> {
    const saleNames = new Map<string, string>();
    if (saleIds.length === 0) return saleNames;
    const saleRows = await this.db
      .select({ id: sale.id, title: sale.title })
      .from(sale)
      .where(inArray(sale.id, saleIds));
    for (const s of saleRows) saleNames.set(s.id, s.title);
    return saleNames;
  }
}
