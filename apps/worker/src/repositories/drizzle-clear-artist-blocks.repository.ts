import type { Database } from "@auction/db";
import { artistProfile, lot } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IClearArtistBlocksRepository } from "../interfaces/clear-artist-blocks.repository.js";

export class DrizzleClearArtistBlocksRepository implements IClearArtistBlocksRepository {
  constructor(private readonly db: Database) {}

  async getArtistStatus(artistId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ status: artistProfile.status })
      .from(artistProfile)
      .where(eq(artistProfile.id, artistId))
      .limit(1);
    return row?.status ?? null;
  }

  async clearLotsArtistReviewRequired(artistId: string): Promise<void> {
    await this.db
      .update(lot)
      .set({ artistReviewRequired: false })
      .where(and(eq(lot.artistId, artistId), eq(lot.artistReviewRequired, true)));
  }
}
