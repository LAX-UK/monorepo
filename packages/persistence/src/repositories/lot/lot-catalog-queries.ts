import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { lot, sale } from "@auction/db/schema";
import type { Lot, LotStatus, SaleStatus } from "@auction/types";
import { PUBLIC_LOT_STATUSES, PUBLIC_SALE_STATUSES } from "@auction/validators";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { ListCatalogLotsBySalePageInput } from "../../interfaces/index.js";
import { mapLotsWithCategories } from "./lot-category-queries.js";
import { catalogLotsBySaleWhere, catalogSalePageOrderBy } from "./lot-list-filters.js";

export async function findLotsBySaleId(db: Database, saleId: string): Promise<Lot[]> {
  const rows = await db
    .select()
    .from(lot)
    .where(and(eq(lot.saleId, saleId), lotNotDeleted()));
  return mapLotsWithCategories(db, rows);
}

export async function findLotsBySaleIds(db: Database, saleIds: string[]): Promise<Lot[]> {
  if (saleIds.length === 0) return [];
  const rows = await db
    .select()
    .from(lot)
    .where(and(inArray(lot.saleId, saleIds), lotNotDeleted()));
  return mapLotsWithCategories(db, rows);
}

export async function countLotsBySaleIds(
  db: Database,
  saleIds: string[],
  options?: { publicOnly?: boolean | undefined },
): Promise<Map<string, number>> {
  if (saleIds.length === 0) return new Map();
  const whereClause = options?.publicOnly
    ? and(
        inArray(lot.saleId, saleIds),
        lotNotDeleted(),
        saleNotDeleted(),
        inArray(lot.status, [...PUBLIC_LOT_STATUSES] as LotStatus[]),
        inArray(sale.status, [...PUBLIC_SALE_STATUSES] as SaleStatus[]),
      )
    : and(inArray(lot.saleId, saleIds), lotNotDeleted());
  const rows = await (options?.publicOnly
    ? db
        .select({
          saleId: lot.saleId,
          n: sql<number>`count(*)::int`,
        })
        .from(lot)
        .innerJoin(sale, eq(lot.saleId, sale.id))
        .where(whereClause)
        .groupBy(lot.saleId)
    : db
        .select({
          saleId: lot.saleId,
          n: sql<number>`count(*)::int`,
        })
        .from(lot)
        .where(whereClause)
        .groupBy(lot.saleId));
  const out = new Map<string, number>();
  for (const row of rows) {
    if (row.saleId) out.set(row.saleId, row.n);
  }
  return out;
}

export async function findPreviewLotsBySaleIds(
  db: Database,
  saleIds: string[],
  limitPerSale: number,
  options?: { publicOnly?: boolean | undefined },
): Promise<Lot[]> {
  if (saleIds.length === 0 || limitPerSale <= 0) return [];

  const lotOrder = sql`coalesce(${lot.lotNumber}, 999999)`;
  const rankExpr = sql<number>`row_number() over (partition by ${lot.saleId} order by ${lotOrder})`;

  const previewWhere = options?.publicOnly
    ? and(
        inArray(lot.saleId, saleIds),
        lotNotDeleted(),
        saleNotDeleted(),
        inArray(lot.status, [...PUBLIC_LOT_STATUSES] as LotStatus[]),
        inArray(sale.status, [...PUBLIC_SALE_STATUSES] as SaleStatus[]),
      )
    : and(inArray(lot.saleId, saleIds), lotNotDeleted());

  const ranked = (
    options?.publicOnly
      ? db
          .select({
            lotId: lot.id,
            rn: rankExpr.as("rn"),
          })
          .from(lot)
          .innerJoin(sale, eq(lot.saleId, sale.id))
          .where(previewWhere)
      : db
          .select({
            lotId: lot.id,
            rn: rankExpr.as("rn"),
          })
          .from(lot)
          .where(previewWhere)
  ).as("ranked_preview_lots");

  const rows = await db
    .select()
    .from(lot)
    .innerJoin(ranked, eq(lot.id, ranked.lotId))
    .where(lte(ranked.rn, limitPerSale));

  return mapLotsWithCategories(
    db,
    rows.map((row) => row.lot),
  );
}

export async function listCatalogLotsBySalePage(
  db: Database,
  input: ListCatalogLotsBySalePageInput,
): Promise<{ items: Lot[]; total: number }> {
  const whereClause = catalogLotsBySaleWhere(input);
  const orderBy = catalogSalePageOrderBy(input.sort);

  if (input.requirePublicSale) {
    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .where(whereClause);
    const rows = await db
      .select({ lotRow: lot })
      .from(lot)
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);
    return {
      items: await mapLotsWithCategories(
        db,
        rows.map((r) => r.lotRow),
      ),
      total: countRow?.n ?? 0,
    };
  }

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lot)
    .where(whereClause);
  const rows = await db
    .select()
    .from(lot)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(input.limit)
    .offset(input.offset);
  return {
    items: await mapLotsWithCategories(db, rows),
    total: countRow?.n ?? 0,
  };
}
