import type { Database } from "@auction/db";
import { watchlist } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IWatchlistRepository, WatchlistRow } from "../services/interfaces/watchlist.js";

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

  async add(userId: string, lotId: string): Promise<WatchlistRow> {
    await this.db
      .insert(watchlist)
      .values({ userId, lotId })
      .onConflictDoNothing({ target: [watchlist.userId, watchlist.lotId] });
    const [row] = await this.db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.lotId, lotId)))
      .limit(1);
    if (!row) throw new Error("Watchlist insert failed");
    return mapRow(row);
  }

  async remove(userId: string, lotId: string): Promise<void> {
    await this.db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.lotId, lotId)));
  }

  async findByUser(userId: string): Promise<WatchlistRow[]> {
    const rows = await this.db.select().from(watchlist).where(eq(watchlist.userId, userId));
    return rows.map(mapRow);
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
}
