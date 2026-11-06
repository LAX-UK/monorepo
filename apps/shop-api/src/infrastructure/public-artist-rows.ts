import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopParty } from "@auction/db/schema";
import { and, count, desc, inArray, isNotNull } from "drizzle-orm";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import type { ArtistDirectoryRow } from "./map-public-artist.js";
import { listedOnSalesChannelSql } from "./sales-channel-listing-sql.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** Columns every public artist read selects; callers join `shopParty` for the name. */
export const publicArtistColumns = {
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
};

type PublicArtistColumnsRow = {
  artistId: string;
  slug: string;
  name: string;
  discipline: string | null;
  bio: string | null;
  shortBio: string | null;
  portraitImageUrl: string | null;
  heroMediaKey: string | null;
  nationality: string | null;
  birthYear: number | null;
  deathYear: number | null;
};

export async function artworkCountByArtistId(
  db: Database,
  artistIds: string[],
  salesChannel?: "shop" | "art",
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
    .where(
      and(
        inArray(shopArtwork.artistId, artistIds),
        publicArtworkVisible(),
        salesChannel ? listedOnSalesChannelSql(salesChannel) : undefined,
      ),
    )
    .groupBy(shopArtwork.artistId);
  return new Map(rows.map((row) => [row.artistId, row.artworkCount]));
}

/**
 * The picture of each artist's newest visible work on the channel, for a card without a portrait.
 * An artist whose works have no picture is absent.
 */
export async function leadImageByArtistId(
  db: Database,
  artistIds: string[],
  resolveMediaUrl: ResolveMediaUrl,
  salesChannel?: "shop" | "art",
): Promise<Map<string, string>> {
  if (artistIds.length === 0) return new Map();
  const rows = await db
    .select({ artistId: shopArtwork.artistId, image: shopArtwork.primaryImageUrl })
    .from(shopArtwork)
    .where(
      and(
        inArray(shopArtwork.artistId, artistIds),
        isNotNull(shopArtwork.primaryImageUrl),
        publicArtworkVisible(),
        salesChannel ? listedOnSalesChannelSql(salesChannel) : undefined,
      ),
    )
    .orderBy(desc(shopArtwork.createdAt));
  const leads = new Map<string, string>();
  for (const row of rows) {
    if (leads.has(row.artistId)) continue;
    const url = resolveMediaUrl(row.image);
    if (url) leads.set(row.artistId, url);
  }
  return leads;
}

export function mapArtistRow(
  row: Omit<PublicArtistColumnsRow, "artistId"> & {
    seoTitle?: string | null;
    seoDescription?: string | null;
    artworkCount: number;
    leadImageUrl?: string | null;
  },
  resolveMediaUrl: ResolveMediaUrl,
): ArtistDirectoryRow {
  return {
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
    seoTitle: row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    artworkCount: row.artworkCount,
    portraitUrl: resolveMediaUrl(row.portraitImageUrl),
    heroUrl: resolveMediaUrl(row.heroMediaKey),
    ...(row.leadImageUrl !== undefined ? { leadImageUrl: row.leadImageUrl } : {}),
  };
}

/** Artwork counts are loaded in one batch and scoped to the channel the caller serves. */
export async function toArtistDirectoryRows(
  db: Database,
  rows: PublicArtistColumnsRow[],
  options: { resolveMediaUrl: ResolveMediaUrl; salesChannel: "shop" | "art" },
): Promise<ArtistDirectoryRow[]> {
  const ids = rows.map((row) => row.artistId);
  const [counts, leads] = await Promise.all([
    artworkCountByArtistId(db, ids, options.salesChannel),
    leadImageByArtistId(db, ids, options.resolveMediaUrl, options.salesChannel),
  ]);
  return rows.map(({ artistId, ...row }) =>
    mapArtistRow(
      {
        ...row,
        artworkCount: counts.get(artistId) ?? 0,
        leadImageUrl: leads.get(artistId) ?? null,
      },
      options.resolveMediaUrl,
    ),
  );
}
