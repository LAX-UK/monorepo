import type { Database } from "@auction/db";
import { legalEntity, lot, lotFulfilment } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import type {
  CollectionDeskLot,
  ICollectionDeskReader,
} from "../interfaces/collection-desk.reader.js";

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export class DrizzleCollectionDeskReader implements ICollectionDeskReader {
  constructor(private readonly db: Database) {}

  async lots(lotIds: readonly string[]): Promise<Map<string, CollectionDeskLot>> {
    const ids = unique(lotIds);
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        lotNumber: lot.lotNumber,
        images: lot.images,
        fulfilmentStatus: lotFulfilment.status,
      })
      .from(lot)
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, lot.id))
      .where(inArray(lot.id, ids));
    return new Map(
      rows.map((row) => [
        row.id,
        {
          lotId: row.id,
          title: row.title,
          lotNumber: row.lotNumber,
          image: row.images[0] ?? null,
          fulfilmentStatus: row.fulfilmentStatus ?? null,
        },
      ]),
    );
  }

  async accountNames(accountIds: readonly string[]): Promise<Map<string, string>> {
    const ids = unique(accountIds);
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: legalEntity.id, name: legalEntity.displayName })
      .from(legalEntity)
      .where(inArray(legalEntity.id, ids));
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
