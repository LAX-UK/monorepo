import type { Database } from "@auction/db";
import { lot, watchlist } from "@auction/db/schema";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type {
  IWatchlistRepository,
  WatchlistListPageInput,
  WatchlistRow,
} from "../interfaces/watchlist.repository.js";

export type {
  WatchlistListPageInput,
  WatchlistPageSort,
} from "../interfaces/watchlist.repository.js";

function mapRow(row: typeof watchlist.$inferSelect): WatchlistRow {
  return {
    id: row.id,
    userId: row.userId,
    lotId: row.lotId,
    createdAt: row.createdAt,
  };
}

export class DrizzleWatchlistRepository implements IWatchlistRepository {
  constructor(private readonly db: Database) {}

  async add(userId: string, lotId: string, conn: Database = this.db): Promise<WatchlistRow> {
    await conn
      .insert(watchlist)
      .values({ userId, lotId })
      .onConflictDoNothing({ target: [watchlist.userId, watchlist.lotId] });
    const [row] = await conn
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.lotId, lotId)))
      .limit(1);
    if (!row) throw new Error("Watchlist insert failed");
    return mapRow(row);
  }

  async remove(userId: string, lotId: string, conn: Database = this.db): Promise<void> {
    await conn
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.lotId, lotId)));
  }

  async findByUser(userId: string): Promise<WatchlistRow[]> {
    const rows = await this.db.select().from(watchlist).where(eq(watchlist.userId, userId));
    return rows.map(mapRow);
  }

  async listIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ lotId: watchlist.lotId })
      .from(watchlist)
      .where(eq(watchlist.userId, userId));
    return rows.map((row) => row.lotId);
  }

  async exists(userId: string, lotId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: watchlist.id })
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.lotId, lotId)))
      .limit(1);
    return rows.length > 0;
  }

  async listUserIdsForLot(lotId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: watchlist.userId })
      .from(watchlist)
      .where(eq(watchlist.lotId, lotId));
    return rows.map((r) => r.userId);
  }

  async countForLot(lotId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(watchlist)
      .where(eq(watchlist.lotId, lotId));
    return row?.value ?? 0;
  }

  async listPage(input: WatchlistListPageInput): Promise<{ rows: WatchlistRow[]; total: number }> {
    const where = eq(watchlist.userId, input.userId);
    const orderBy = (() => {
      switch (input.sort ?? "addedDesc") {
        case "endingSoon":
          return asc(lot.endTime);
        case "priceAsc":
          return asc(lot.currentPrice);
        case "priceDesc":
          return desc(lot.currentPrice);
        default:
          return desc(watchlist.createdAt);
      }
    })();

    const [countRow] = await this.db
      .select({ value: count() })
      .from(watchlist)
      .innerJoin(lot, eq(watchlist.lotId, lot.id))
      .where(where);
    const rows = await this.db
      .select({ watchlistRow: watchlist })
      .from(watchlist)
      .innerJoin(lot, eq(watchlist.lotId, lot.id))
      .where(where)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);

    return {
      rows: rows.map((r) => mapRow(r.watchlistRow)),
      total: countRow?.value ?? 0,
    };
  }
}
