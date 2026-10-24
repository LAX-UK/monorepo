import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopFollowedArtist,
  shopParty,
  shopSavedArtwork,
} from "@auction/db/schema";
import type { PortalFollowedArtist, PortalSavedArtwork } from "@auction/shop-contracts";
import { and, desc, eq } from "drizzle-orm";
import type { PortalFavoritesPort } from "../application/ports/portal-favorites.port.js";
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";

export function createDrizzlePortalFavoritesRepository(db: Database): PortalFavoritesPort {
  return {
    async listSavedArtworks(identitySubjectId) {
      const rows = await db
        .select({
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          artistName: shopParty.displayName,
          artistSlug: shopArtist.slug,
          imageUrl: shopArtwork.primaryImageUrl,
          salesChannel: shopArtwork.salesChannel,
          savedAt: shopSavedArtwork.createdAt,
        })
        .from(shopSavedArtwork)
        .innerJoin(shopArtwork, eq(shopSavedArtwork.artworkId, shopArtwork.id))
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(eq(shopSavedArtwork.identitySubjectId, identitySubjectId), publicArtworkVisible()),
        )
        .orderBy(desc(shopSavedArtwork.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);

      return rows.map(
        (row): PortalSavedArtwork => ({
          artworkSlug: row.artworkSlug,
          artworkTitle: row.artworkTitle,
          artistName: row.artistName,
          artistSlug: row.artistSlug,
          imageUrl: row.imageUrl,
          salesChannel: row.salesChannel,
          savedAt: row.savedAt.toISOString(),
        }),
      );
    },

    async saveArtwork(identitySubjectId, artworkSlug) {
      const [artwork] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, artworkSlug))
        .limit(1);
      if (!artwork) return "artwork_not_found";

      const inserted = await db
        .insert(shopSavedArtwork)
        .values({ identitySubjectId, artworkId: artwork.id })
        .onConflictDoNothing()
        .returning({ id: shopSavedArtwork.id });
      return inserted.length > 0 ? "saved" : "already_saved";
    },

    async unsaveArtwork(identitySubjectId, artworkSlug) {
      const [artwork] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, artworkSlug))
        .limit(1);
      if (!artwork) return "artwork_not_found";

      const deleted = await db
        .delete(shopSavedArtwork)
        .where(
          and(
            eq(shopSavedArtwork.identitySubjectId, identitySubjectId),
            eq(shopSavedArtwork.artworkId, artwork.id),
          ),
        )
        .returning({ id: shopSavedArtwork.id });
      return deleted.length > 0 ? "removed" : "not_saved";
    },

    async listFollowedArtists(identitySubjectId) {
      const rows = await db
        .select({
          artistSlug: shopArtist.slug,
          artistName: shopParty.displayName,
          portraitUrl: shopArtist.portraitImageUrl,
          followedAt: shopFollowedArtist.createdAt,
        })
        .from(shopFollowedArtist)
        .innerJoin(shopArtist, eq(shopFollowedArtist.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopFollowedArtist.identitySubjectId, identitySubjectId))
        .orderBy(desc(shopFollowedArtist.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);

      return rows.map(
        (row): PortalFollowedArtist => ({
          artistSlug: row.artistSlug,
          artistName: row.artistName,
          portraitUrl: row.portraitUrl,
          followedAt: row.followedAt.toISOString(),
        }),
      );
    },

    async followArtist(identitySubjectId, artistSlug) {
      const [artist] = await db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(eq(shopArtist.slug, artistSlug))
        .limit(1);
      if (!artist) return "artist_not_found";

      const inserted = await db
        .insert(shopFollowedArtist)
        .values({ identitySubjectId, artistId: artist.id })
        .onConflictDoNothing()
        .returning({ id: shopFollowedArtist.id });
      return inserted.length > 0 ? "followed" : "already_followed";
    },

    async unfollowArtist(identitySubjectId, artistSlug) {
      const [artist] = await db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(eq(shopArtist.slug, artistSlug))
        .limit(1);
      if (!artist) return "artist_not_found";

      const deleted = await db
        .delete(shopFollowedArtist)
        .where(
          and(
            eq(shopFollowedArtist.identitySubjectId, identitySubjectId),
            eq(shopFollowedArtist.artistId, artist.id),
          ),
        )
        .returning({ id: shopFollowedArtist.id });
      return deleted.length > 0 ? "removed" : "not_following";
    },
  };
}
