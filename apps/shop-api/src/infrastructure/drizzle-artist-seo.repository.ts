import type { Database } from "@auction/db";
import { shopArtist } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ArtistSeoWriter } from "../application/ports/artist-seo.writer.js";

export function createDrizzleArtistSeoWriter(db: Database): ArtistSeoWriter {
  return {
    async updateArtistSeo(artistId, fields) {
      const rows = await db
        .update(shopArtist)
        .set({ seoTitle: fields.seoTitle, seoDescription: fields.seoDescription })
        .where(eq(shopArtist.id, artistId))
        .returning({ id: shopArtist.id });
      return rows.length > 0;
    },
  };
}
