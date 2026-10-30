import type { Database } from "@auction/db";
import { artistWatchlist } from "@auction/db/schema";
import type { ArtistAlertCriteria } from "@auction/domain";
import { and, eq } from "drizzle-orm";
import type {
  ArtistWatchlistRow,
  IArtistWatchlistRepository,
} from "../interfaces/artist-watchlist.repository.js";

function mapRow(row: typeof artistWatchlist.$inferSelect): ArtistWatchlistRow {
  return {
    id: row.id,
    userId: row.userId,
    artistId: row.artistId,
    createdAt: row.createdAt,
    alert: {
      medium: row.alertMedium,
      priceMin: row.alertPriceMin,
      priceMax: row.alertPriceMax,
    },
  };
}

export class DrizzleArtistWatchlistRepository implements IArtistWatchlistRepository {
  constructor(private readonly db: Database) {}

  async add(userId: string, artistId: string): Promise<ArtistWatchlistRow> {
    await this.db
      .insert(artistWatchlist)
      .values({ userId, artistId })
      .onConflictDoNothing({ target: [artistWatchlist.userId, artistWatchlist.artistId] });
    const [row] = await this.db
      .select()
      .from(artistWatchlist)
      .where(and(eq(artistWatchlist.userId, userId), eq(artistWatchlist.artistId, artistId)))
      .limit(1);
    if (!row) throw new Error("Artist watchlist insert failed");
    return mapRow(row);
  }

  async remove(userId: string, artistId: string): Promise<void> {
    await this.db
      .delete(artistWatchlist)
      .where(and(eq(artistWatchlist.userId, userId), eq(artistWatchlist.artistId, artistId)));
  }

  async findByUser(userId: string): Promise<ArtistWatchlistRow[]> {
    const rows = await this.db
      .select()
      .from(artistWatchlist)
      .where(eq(artistWatchlist.userId, userId));
    return rows.map(mapRow);
  }

  async exists(userId: string, artistId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: artistWatchlist.id })
      .from(artistWatchlist)
      .where(and(eq(artistWatchlist.userId, userId), eq(artistWatchlist.artistId, artistId)))
      .limit(1);
    return rows.length > 0;
  }

  async setAlert(
    userId: string,
    artistId: string,
    criteria: ArtistAlertCriteria,
  ): Promise<ArtistWatchlistRow | null> {
    const [row] = await this.db
      .update(artistWatchlist)
      .set({
        alertMedium: criteria.medium,
        alertPriceMin: criteria.priceMin,
        alertPriceMax: criteria.priceMax,
        alertUpdatedAt: new Date(),
      })
      .where(and(eq(artistWatchlist.userId, userId), eq(artistWatchlist.artistId, artistId)))
      .returning();
    return row ? mapRow(row) : null;
  }
}
