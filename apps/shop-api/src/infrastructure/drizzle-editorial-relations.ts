import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEditorialExhibition,
  shopEditorialExhibitionArtist,
  shopEditorialExhibitionArtwork,
  shopEditorialStory,
  shopEditorialStoryArtist,
  shopEditorialStoryArtwork,
  shopEditorialStoryExhibition,
  shopEditorialVenue,
  shopParty,
} from "@auction/db/schema";
import { defaultEditorialStoryCategory } from "@auction/shop-contracts";
import { type SQL, and, asc, desc, eq } from "drizzle-orm";
import type {
  EditorialArtistRelationsReadModel,
  EditorialExhibitionDetailReadModel,
  EditorialExhibitionSummaryReadModel,
  EditorialStoryDetailReadModel,
  EditorialStorySummaryReadModel,
} from "../application/ports/editorial.repository.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import { toPublicArtistDetail, toPublicArtistSummary } from "./map-public-artist.js";
import { publicArtistColumns, toArtistDirectoryRows } from "./public-artist-rows.js";
import { publicArtworkColumns, toPublicArtworkSummaries } from "./public-artwork-rows.js";
import { listedOnSalesChannelSql } from "./sales-channel-listing-sql.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** Caps each related rail; editorial joins are hand-curated, so 24 is generous. */
export const EDITORIAL_RELATED_LIMIT = 24;

/** Editorial is lax.art only, so related works follow Art's catalogue channel. */
const ART_SALES_CHANNEL = "art";

const publishedExhibition = eq(shopEditorialExhibition.status, "published");
const publishedStory = eq(shopEditorialStory.status, "published");

export const exhibitionSummaryOrder = [
  desc(shopEditorialExhibition.startsOn),
  desc(shopEditorialExhibition.createdAt),
  asc(shopEditorialExhibition.slug),
];
export const storySummaryOrder = [
  desc(shopEditorialStory.publishedAt),
  desc(shopEditorialStory.createdAt),
  asc(shopEditorialStory.slug),
];
const artistNameOrder = [asc(shopParty.displayName), asc(shopArtist.slug)];

/** Editors can leave a text field as an empty string; storefronts get `null` either way. */
export function blankToNull(value: string | null): string | null {
  return value?.trim() ? value : null;
}

type ExhibitionSummaryRow = {
  slug: string;
  kind: EditorialExhibitionSummaryReadModel["kind"];
  title: string;
  summary: string | null;
  startsOn: string | null;
  endsOn: string | null;
  coverMediaKey: string | null;
  featured: boolean;
  subtitle: string | null;
  venueSlug: string | null;
  venueName: string | null;
};

type StorySummaryRow = {
  slug: string;
  kind: EditorialStorySummaryReadModel["kind"];
  category: EditorialStorySummaryReadModel["category"] | null;
  title: string;
  standfirst: string | null;
  coverMediaKey: string | null;
  featured: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  readMinutes: number | null;
  readMinutesEstimate: number | null;
  series: string | null;
  episodeNumber: number | null;
  durationSeconds: number | null;
  publicationName: string | null;
  externalUrl: string | null;
};

/** Venue is joined in the same query (published venues only) to avoid a lookup per card. */
export function selectExhibitionSummaries(db: Database) {
  return db
    .select({
      slug: shopEditorialExhibition.slug,
      kind: shopEditorialExhibition.kind,
      title: shopEditorialExhibition.title,
      summary: shopEditorialExhibition.summary,
      startsOn: shopEditorialExhibition.startsOn,
      endsOn: shopEditorialExhibition.endsOn,
      coverMediaKey: shopEditorialExhibition.coverMediaKey,
      featured: shopEditorialExhibition.featured,
      subtitle: shopEditorialExhibition.subtitle,
      venueSlug: shopEditorialVenue.slug,
      venueName: shopEditorialVenue.name,
    })
    .from(shopEditorialExhibition)
    .leftJoin(
      shopEditorialVenue,
      and(
        eq(shopEditorialVenue.id, shopEditorialExhibition.venueId),
        eq(shopEditorialVenue.status, "published"),
      ),
    )
    .$dynamic();
}

export function toExhibitionSummary(
  row: ExhibitionSummaryRow,
  resolveMediaUrl: ResolveMediaUrl,
): EditorialExhibitionSummaryReadModel {
  return {
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    coverUrl: resolveMediaUrl(row.coverMediaKey),
    featured: row.featured,
    subtitle: blankToNull(row.subtitle),
    venue: row.venueSlug && row.venueName ? { slug: row.venueSlug, name: row.venueName } : null,
  };
}

export function selectStorySummaries(db: Database) {
  return db
    .select({
      slug: shopEditorialStory.slug,
      kind: shopEditorialStory.kind,
      category: shopEditorialStory.category,
      title: shopEditorialStory.title,
      standfirst: shopEditorialStory.standfirst,
      coverMediaKey: shopEditorialStory.coverMediaKey,
      featured: shopEditorialStory.featured,
      publishedAt: shopEditorialStory.publishedAt,
      updatedAt: shopEditorialStory.updatedAt,
      authorName: shopEditorialStory.authorName,
      readMinutes: shopEditorialStory.readMinutes,
      readMinutesEstimate: shopEditorialStory.readMinutesEstimate,
      series: shopEditorialStory.series,
      episodeNumber: shopEditorialStory.episodeNumber,
      durationSeconds: shopEditorialStory.durationSeconds,
      publicationName: shopEditorialStory.publicationName,
      externalUrl: shopEditorialStory.externalUrl,
    })
    .from(shopEditorialStory)
    .$dynamic();
}

export function toStorySummary(
  row: StorySummaryRow,
  resolveMediaUrl: ResolveMediaUrl,
): EditorialStorySummaryReadModel {
  return {
    slug: row.slug,
    kind: row.kind,
    category: row.category ?? defaultEditorialStoryCategory(row.kind),
    title: row.title,
    standfirst: row.standfirst,
    coverUrl: resolveMediaUrl(row.coverMediaKey),
    featured: row.featured,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    authorName: blankToNull(row.authorName),
    readMinutes: row.readMinutes ?? row.readMinutesEstimate,
    series: blankToNull(row.series),
    episodeNumber: row.episodeNumber,
    durationSeconds: row.durationSeconds,
    publicationName: blankToNull(row.publicationName),
    externalUrl: blankToNull(row.externalUrl),
  };
}

export function createEditorialRelationQueries(db: Database, resolveMediaUrl: ResolveMediaUrl) {
  async function exhibitionsWhere(
    join: typeof shopEditorialExhibitionArtist | typeof shopEditorialStoryExhibition,
    condition: SQL,
  ): Promise<EditorialExhibitionSummaryReadModel[]> {
    const rows = await selectExhibitionSummaries(db)
      .innerJoin(join, eq(join.exhibitionId, shopEditorialExhibition.id))
      .where(and(condition, publishedExhibition))
      .orderBy(...exhibitionSummaryOrder)
      .limit(EDITORIAL_RELATED_LIMIT);
    return rows.map((row) => toExhibitionSummary(row, resolveMediaUrl));
  }

  async function storiesWhere(
    join: typeof shopEditorialStoryArtist | typeof shopEditorialStoryExhibition,
    condition: SQL,
  ): Promise<EditorialStorySummaryReadModel[]> {
    const rows = await selectStorySummaries(db)
      .innerJoin(join, eq(join.storyId, shopEditorialStory.id))
      .where(and(condition, publishedStory))
      .orderBy(...storySummaryOrder)
      .limit(EDITORIAL_RELATED_LIMIT);
    return rows.map((row) => toStorySummary(row, resolveMediaUrl));
  }

  async function artistRowsWhere(
    join: typeof shopEditorialExhibitionArtist | typeof shopEditorialStoryArtist,
    condition: SQL,
  ) {
    // Editors set `position`; artists they left at the default fall back to name order.
    const rows = await db
      .select(publicArtistColumns)
      .from(join)
      .innerJoin(shopArtist, eq(join.artistId, shopArtist.id))
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(condition)
      .orderBy(asc(join.position), ...artistNameOrder)
      .limit(EDITORIAL_RELATED_LIMIT);
    return toArtistDirectoryRows(db, rows, { resolveMediaUrl, salesChannel: ART_SALES_CHANNEL });
  }

  async function artworksWhere(
    join: typeof shopEditorialExhibitionArtwork | typeof shopEditorialStoryArtwork,
    condition: SQL,
    order: SQL[],
  ) {
    const rows = await db
      .select(publicArtworkColumns)
      .from(join)
      .innerJoin(shopArtwork, eq(join.artworkId, shopArtwork.id))
      .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(and(condition, listedOnSalesChannelSql(ART_SALES_CHANNEL), publicArtworkVisible()))
      .orderBy(...order)
      .limit(EDITORIAL_RELATED_LIMIT);
    return toPublicArtworkSummaries(db, rows, resolveMediaUrl);
  }

  return {
    async exhibitionRelations(
      exhibitionId: string,
    ): Promise<Pick<EditorialExhibitionDetailReadModel, "artworks" | "artists" | "stories">> {
      const [artworks, artists, stories] = await Promise.all([
        artworksWhere(
          shopEditorialExhibitionArtwork,
          eq(shopEditorialExhibitionArtwork.exhibitionId, exhibitionId),
          [asc(shopEditorialExhibitionArtwork.position)],
        ),
        artistRowsWhere(
          shopEditorialExhibitionArtist,
          eq(shopEditorialExhibitionArtist.exhibitionId, exhibitionId),
        ),
        storiesWhere(
          shopEditorialStoryExhibition,
          eq(shopEditorialStoryExhibition.exhibitionId, exhibitionId),
        ),
      ]);
      return { artworks, artists: artists.map(toPublicArtistDetail), stories };
    },

    async storyRelations(storyId: string): Promise<EditorialStoryDetailReadModel["related"]> {
      const [artists, artworks, exhibitions] = await Promise.all([
        artistRowsWhere(shopEditorialStoryArtist, eq(shopEditorialStoryArtist.storyId, storyId)),
        // Editor order first; works left at the default position show newest first.
        artworksWhere(shopEditorialStoryArtwork, eq(shopEditorialStoryArtwork.storyId, storyId), [
          asc(shopEditorialStoryArtwork.position),
          desc(shopArtwork.createdAt),
          asc(shopArtwork.slug),
        ]),
        exhibitionsWhere(
          shopEditorialStoryExhibition,
          eq(shopEditorialStoryExhibition.storyId, storyId),
        ),
      ]);
      return { artists: artists.map(toPublicArtistSummary), artworks, exhibitions };
    },

    async artistRelations(artistSlug: string): Promise<EditorialArtistRelationsReadModel | null> {
      const [artist] = await db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(eq(shopArtist.slug, artistSlug))
        .limit(1);
      if (!artist) return null;
      const [exhibitions, stories] = await Promise.all([
        exhibitionsWhere(
          shopEditorialExhibitionArtist,
          eq(shopEditorialExhibitionArtist.artistId, artist.id),
        ),
        storiesWhere(shopEditorialStoryArtist, eq(shopEditorialStoryArtist.artistId, artist.id)),
      ]);
      return { exhibitions, stories };
    },
  };
}
