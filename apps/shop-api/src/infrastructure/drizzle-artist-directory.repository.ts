import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopHomePlacement, shopParty } from "@auction/db/schema";
import { maxItemsForPlacement } from "@auction/shop-domain";
import { and, asc, count, desc, eq, inArray, lt, or } from "drizzle-orm";
import type {
  ArtistDirectoryReader,
  ListPublicArtistsInput,
  ListPublicArtistsResult,
} from "../application/ports/artist-directory.reader.js";
import { toPublicArtistDetail, toPublicArtistSummary } from "./map-public-artist.js";
import { publishedHomePlacementForSlot } from "./shop-home-placement-queries.js";

async function artworkCountByArtistId(
  db: Database,
  artistIds: string[],
): Promise<Map<string, number>> {
  if (artistIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      artistId: shopArtwork.artistId,
      artworkCount: count(),
    })
    .from(shopArtwork)
    .where(inArray(shopArtwork.artistId, artistIds))
    .groupBy(shopArtwork.artistId);
  return new Map(rows.map((row) => [row.artistId, row.artworkCount]));
}

export function createDrizzleArtistDirectoryRepository(db: Database): ArtistDirectoryReader {
  return {
    async listPublicArtists(input: ListPublicArtistsInput): Promise<ListPublicArtistsResult> {
      const placementCap =
        input.placement === "featured_artists" ? maxItemsForPlacement("featured_artists") : null;
      const limit = Math.min(Math.max(input.limit, 1), placementCap ?? 50);
      const cursor = input.cursor;

      if (input.placement === "featured_artists") {
        const rows = await db
          .select({
            artistId: shopArtist.id,
            slug: shopArtist.slug,
            name: shopParty.displayName,
            discipline: shopArtist.discipline,
            bio: shopArtist.bio,
            portraitImageUrl: shopArtist.portraitImageUrl,
            createdAt: shopArtist.createdAt,
          })
          .from(shopHomePlacement)
          .innerJoin(shopArtist, eq(shopHomePlacement.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .where(publishedHomePlacementForSlot("featured_artists"))
          .orderBy(asc(shopHomePlacement.position))
          .limit(limit);
        const counts = await artworkCountByArtistId(
          db,
          rows.map((row) => row.artistId),
        );
        return {
          items: rows.map((row) =>
            toPublicArtistSummary({
              slug: row.slug,
              name: row.name,
              discipline: row.discipline,
              bio: row.bio,
              portraitImageUrl: row.portraitImageUrl,
              artworkCount: counts.get(row.artistId) ?? 0,
            }),
          ),
        };
      }

      const rows = await db
        .select({
          artistId: shopArtist.id,
          slug: shopArtist.slug,
          name: shopParty.displayName,
          discipline: shopArtist.discipline,
          bio: shopArtist.bio,
          portraitImageUrl: shopArtist.portraitImageUrl,
          createdAt: shopArtist.createdAt,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          cursor
            ? or(
                lt(shopArtist.createdAt, cursor.createdAt),
                and(eq(shopArtist.createdAt, cursor.createdAt), lt(shopArtist.id, cursor.id)),
              )
            : undefined,
        )
        .orderBy(desc(shopArtist.createdAt), desc(shopArtist.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const counts = await artworkCountByArtistId(
        db,
        page.map((row) => row.artistId),
      );
      const items = page.map((row) =>
        toPublicArtistSummary({
          slug: row.slug,
          name: row.name,
          discipline: row.discipline,
          bio: row.bio,
          portraitImageUrl: row.portraitImageUrl,
          artworkCount: counts.get(row.artistId) ?? 0,
        }),
      );
      const last = page.at(-1);
      if (hasMore && last) {
        return {
          items,
          nextCursor: {
            createdAt: last.createdAt,
            id: last.artistId,
          },
        };
      }
      return { items };
    },

    async getPublicArtistBySlug(slug: string) {
      const [row] = await db
        .select({
          artistId: shopArtist.id,
          slug: shopArtist.slug,
          name: shopParty.displayName,
          discipline: shopArtist.discipline,
          bio: shopArtist.bio,
          portraitImageUrl: shopArtist.portraitImageUrl,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtist.slug, slug))
        .limit(1);
      if (!row) {
        return null;
      }
      const counts = await artworkCountByArtistId(db, [row.artistId]);
      return toPublicArtistDetail({
        slug: row.slug,
        name: row.name,
        discipline: row.discipline,
        bio: row.bio,
        portraitImageUrl: row.portraitImageUrl,
        artworkCount: counts.get(row.artistId) ?? 0,
      });
    },
  };
}
