import type { Database } from "@auction/db";
import { lotCategories } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import { asc, inArray } from "drizzle-orm";
import { type LotRow, mapLotRow } from "../../lib/mappers/lot-row-mapper.js";

export async function categoryIdsByLotIds(
  db: Database,
  ids: string[],
): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const rows = await db
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

export async function mapLotsWithCategories(db: Database, rows: LotRow[]): Promise<Lot[]> {
  const categoriesByLot = await categoryIdsByLotIds(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapLotRow(row, categoriesByLot.get(row.id) ?? []));
}

export async function mapLotWithCategories(db: Database, row: LotRow): Promise<Lot> {
  const categories = await categoryIdsByLotIds(db, [row.id]);
  return mapLotRow(row, categories.get(row.id) ?? []);
}
