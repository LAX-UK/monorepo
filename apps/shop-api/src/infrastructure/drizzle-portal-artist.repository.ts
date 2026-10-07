import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { PortalArtistReader } from "../application/ports/portal-artist.reader.js";
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { listArtistSalesForArtworkIds } from "./shop-artist-sales-query.js";

export function createDrizzlePortalArtistRepository(db: Database): PortalArtistReader {
  return {
    async getLinkedArtist(identitySubjectId) {
      const [row] = await db
        .select({
          artistId: shopArtist.id,
          slug: shopArtist.slug,
          displayName: shopParty.displayName,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.identitySubjectId, identitySubjectId))
        .limit(1);
      if (!row) return null;
      return row;
    },

    async listArtworks(identitySubjectId) {
      const [artist] = await db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(eq(shopArtist.identitySubjectId, identitySubjectId))
        .limit(1);
      if (!artist) return [];
      const rows = await db
        .select({
          artworkId: shopArtwork.id,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
          saleState: shopArtwork.saleState,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.artistId, artist.id))
        .orderBy(shopArtwork.title)
        .limit(PORTAL_ME_LIST_LIMIT);
      return rows;
    },

    async listSales(identitySubjectId) {
      const [artist] = await db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(eq(shopArtist.identitySubjectId, identitySubjectId))
        .limit(1);
      if (!artist) return [];

      const artworks = await db
        .select({ id: shopArtwork.id, title: shopArtwork.title })
        .from(shopArtwork)
        .where(eq(shopArtwork.artistId, artist.id));
      const artworkIds = artworks.map((a) => a.id);
      if (artworkIds.length === 0) return [];

      const rows = await listArtistSalesForArtworkIds(db, artworkIds, PORTAL_ME_LIST_LIMIT);
      return rows.map((row) => ({
        saleId: row.saleId,
        channel: row.channel,
        artworkTitle: row.artworkTitle,
        editionNumber: row.editionNumber,
        grossPence: row.grossPence,
        occurredAt: row.occurredAt,
      }));
    },
  };
}
