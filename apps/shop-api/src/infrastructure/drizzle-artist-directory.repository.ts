import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopHomePlacement, shopParty } from "@auction/db/schema";
import { maxItemsForPlacement } from "@auction/shop-domain";
import { and, asc, desc, eq, exists, ilike, lt, or, sql } from "drizzle-orm";
import type {
  ArtistDirectoryReader,
  ListPublicArtistsInput,
  ListPublicArtistsResult,
  PublicArtistSort,
} from "../application/ports/artist-directory.reader.js";
import { publicArtistVisible, publicArtworkVisible } from "./artwork-visibility-sql.js";
import { toPublicArtistDetail, toPublicArtistSummary } from "./map-public-artist.js";
import { artworkCountByArtistId, mapArtistRow } from "./public-artist-rows.js";
import { publishedHomePlacementForSlot } from "./shop-home-placement-queries.js";

type ArtistDirectoryRepositoryOptions = {
  resolveMediaUrl: (value: string | null | undefined) => string | null;
};

function orderByForArtistSort(sort: PublicArtistSort | undefined) {
  switch (sort) {
    case "nameAsc":
      return [asc(shopParty.displayName), asc(shopArtist.id)];
    case "nameDesc":
      return [desc(shopParty.displayName), desc(shopArtist.id)];
    default:
      return [desc(shopArtist.createdAt), desc(shopArtist.id)];
  }
}

export function createDrizzleArtistDirectoryRepository(
  db: Database,
  options: ArtistDirectoryRepositoryOptions = {
    resolveMediaUrl: (value) => value ?? null,
  },
): ArtistDirectoryReader {
  const { resolveMediaUrl } = options;

  return {
    async listPublicArtists(input: ListPublicArtistsInput): Promise<ListPublicArtistsResult> {
      const placementCap =
        input.placement === "featured_artists" ? maxItemsForPlacement("featured_artists") : null;
      const limit = Math.min(Math.max(input.limit, 1), placementCap ?? 50);
      const cursor = input.cursor;
      const sort = input.sort ?? "newest";
      const letter = input.letter?.trim().slice(0, 1).toUpperCase();
      const channelFilter = input.salesChannel
        ? exists(
            db
              .select({ one: sql`1` })
              .from(shopArtwork)
              .where(
                and(
                  eq(shopArtwork.artistId, shopArtist.id),
                  eq(shopArtwork.salesChannel, input.salesChannel),
                  publicArtworkVisible(),
                ),
              ),
          )
        : undefined;

      const artistSelect = {
        artistId: shopArtist.id,
        slug: shopArtist.slug,
        name: shopParty.displayName,
        discipline: shopArtist.discipline,
        bio: shopArtist.bio,
        shortBio: shopArtist.shortBio,
        portraitImageUrl: shopArtist.portraitImageUrl,
        heroMediaKey: shopArtist.heroMediaKey,
        nationality: shopArtist.nationality,
        birthYear: shopArtist.birthYear,
        deathYear: shopArtist.deathYear,
        createdAt: shopArtist.createdAt,
      };

      if (input.placement === "featured_artists") {
        const rows = await db
          .select(artistSelect)
          .from(shopHomePlacement)
          .innerJoin(shopArtist, eq(shopHomePlacement.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .where(
            and(
              publishedHomePlacementForSlot("featured_artists"),
              channelFilter,
              publicArtistVisible(),
            ),
          )
          .orderBy(asc(shopHomePlacement.position))
          .limit(limit);
        const counts = await artworkCountByArtistId(
          db,
          rows.map((row) => row.artistId),
          input.salesChannel,
        );
        return {
          items: rows.map((row) =>
            toPublicArtistSummary(
              mapArtistRow(
                {
                  slug: row.slug,
                  name: row.name,
                  discipline: row.discipline,
                  bio: row.bio,
                  shortBio: row.shortBio,
                  portraitImageUrl: row.portraitImageUrl,
                  heroMediaKey: row.heroMediaKey,
                  nationality: row.nationality,
                  birthYear: row.birthYear,
                  deathYear: row.deathYear,
                  artworkCount: counts.get(row.artistId) ?? 0,
                },
                resolveMediaUrl,
              ),
            ),
          ),
        };
      }

      const rows = await db
        .select(artistSelect)
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            sort === "newest" && cursor
              ? or(
                  lt(shopArtist.createdAt, cursor.createdAt),
                  and(eq(shopArtist.createdAt, cursor.createdAt), lt(shopArtist.id, cursor.id)),
                )
              : undefined,
            input.q
              ? or(
                  ilike(shopParty.displayName, `%${input.q}%`),
                  ilike(shopArtist.slug, `%${input.q}%`),
                )
              : undefined,
            letter && /^[A-Z]$/.test(letter)
              ? sql`upper(substr(${shopParty.displayName}, 1, 1)) = ${letter}`
              : undefined,
            channelFilter,
            publicArtistVisible(),
          ),
        )
        .orderBy(...orderByForArtistSort(sort))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const counts = await artworkCountByArtistId(
        db,
        page.map((row) => row.artistId),
        input.salesChannel,
      );
      const items = page.map((row) =>
        toPublicArtistSummary(
          mapArtistRow(
            {
              slug: row.slug,
              name: row.name,
              discipline: row.discipline,
              bio: row.bio,
              shortBio: row.shortBio,
              portraitImageUrl: row.portraitImageUrl,
              heroMediaKey: row.heroMediaKey,
              nationality: row.nationality,
              birthYear: row.birthYear,
              deathYear: row.deathYear,
              artworkCount: counts.get(row.artistId) ?? 0,
            },
            resolveMediaUrl,
          ),
        ),
      );
      const last = page.at(-1);
      if (hasMore && last && sort === "newest") {
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
          shortBio: shopArtist.shortBio,
          portraitImageUrl: shopArtist.portraitImageUrl,
          heroMediaKey: shopArtist.heroMediaKey,
          nationality: shopArtist.nationality,
          birthYear: shopArtist.birthYear,
          deathYear: shopArtist.deathYear,
          seoTitle: shopArtist.seoTitle,
          seoDescription: shopArtist.seoDescription,
        })
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(and(eq(shopArtist.slug, slug), publicArtistVisible()))
        .limit(1);
      if (!row) {
        return null;
      }
      const counts = await artworkCountByArtistId(db, [row.artistId]);
      return toPublicArtistDetail(
        mapArtistRow(
          {
            slug: row.slug,
            name: row.name,
            discipline: row.discipline,
            bio: row.bio,
            shortBio: row.shortBio,
            portraitImageUrl: row.portraitImageUrl,
            heroMediaKey: row.heroMediaKey,
            nationality: row.nationality,
            birthYear: row.birthYear,
            deathYear: row.deathYear,
            seoTitle: row.seoTitle,
            seoDescription: row.seoDescription,
            artworkCount: counts.get(row.artistId) ?? 0,
          },
          resolveMediaUrl,
        ),
      );
    },
  };
}
