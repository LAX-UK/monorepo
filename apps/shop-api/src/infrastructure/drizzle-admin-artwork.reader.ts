import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopEdition,
  shopParty,
} from "@auction/db/schema";
import type { AdminArtworkDetail, AdminArtworkState } from "@auction/shop-contracts";
import {
  artworkCatalogueState,
  artworkPublishBlockers,
  summariseEditionRun,
} from "@auction/shop-domain";
import { type SQL, and, asc, count, eq, or, sql } from "drizzle-orm";
import {
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  truncateCatalogueCursorDate,
} from "../application/catalogue-cursor.js";
import type {
  AdminArtworkListInput,
  AdminArtworkReader,
} from "../application/ports/artwork-catalogue-admin.js";
import { keysetBeforeCreatedAtId, orderByMsTimestampIdDesc } from "./admin-created-at-keyset.js";
import {
  artworkEditionCountSql,
  artworkSoldEditionCountSql,
  artworkStateSql,
} from "./artwork-visibility-sql.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** Every filter except the view, so the view tabs can count under the same search. */
function listConditions(input: AdminArtworkListInput): SQL[] {
  const conditions: SQL[] = [];
  const q = input.q?.trim();
  if (q) {
    const pattern = containsPattern(q);
    conditions.push(
      or(
        sql`${shopArtwork.title} ILIKE ${pattern}`,
        sql`${shopParty.displayName} ILIKE ${pattern}`,
      ) as SQL,
    );
  }
  if (input.artistId) conditions.push(eq(shopArtwork.artistId, input.artistId));
  if (input.saleState) conditions.push(eq(shopArtwork.saleState, input.saleState));
  if (input.salesChannel) conditions.push(eq(shopArtwork.salesChannel, input.salesChannel));
  return conditions;
}

const EMPTY_COUNTS: Record<AdminArtworkState, number> = {
  live: 0,
  draft: 0,
  sold_out: 0,
  archived: 0,
};

export function createDrizzleAdminArtworkReader(
  db: Database,
  options: { resolveMediaUrl: ResolveMediaUrl },
): AdminArtworkReader {
  const { resolveMediaUrl } = options;
  return {
    async listArtworks(input) {
      const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const cursor = decodeCatalogueCursor(input.cursor);
      const filters = listConditions(input);
      const [rows, countRows] = await Promise.all([
        db
          .select({
            id: shopArtwork.id,
            slug: shopArtwork.slug,
            title: shopArtwork.title,
            artistId: shopArtwork.artistId,
            artistName: shopParty.displayName,
            primaryImageUrl: shopArtwork.primaryImageUrl,
            eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
            printPricePence: shopArtwork.printPricePence,
            saleState: shopArtwork.saleState,
            salesChannel: shopArtwork.salesChannel,
            publishedAt: shopArtwork.publishedAt,
            archivedAt: shopArtwork.archivedAt,
            updatedAt: shopArtwork.updatedAt,
            editionCount: artworkEditionCountSql,
            soldEditionCount: artworkSoldEditionCountSql,
          })
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .where(
            and(
              ...filters,
              input.state ? sql`${artworkStateSql} = ${input.state}` : undefined,
              cursor
                ? keysetBeforeCreatedAtId(shopArtwork.updatedAt, shopArtwork.id, cursor)
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampIdDesc(shopArtwork.updatedAt, shopArtwork.id))
          .limit(limit + 1),
        db
          .select({ state: artworkStateSql, total: count() })
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .where(and(...filters))
          .groupBy(artworkStateSql),
      ]);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page.at(-1);
      const counts = { ...EMPTY_COUNTS };
      for (const row of countRows) counts[row.state] = Number(row.total);
      return {
        items: page.map((row) => ({
          artworkId: row.id,
          slug: row.slug,
          title: row.title,
          artistId: row.artistId,
          artistName: row.artistName,
          thumbnailUrl: resolveMediaUrl(row.primaryImageUrl),
          editionSize: Number(row.editionCount),
          soldEditionCount: Number(row.soldEditionCount),
          printPricePence: row.printPricePence,
          saleState: row.saleState,
          salesChannel: row.salesChannel,
          state: artworkCatalogueState({
            publishedAt: row.publishedAt,
            archivedAt: row.archivedAt,
            saleState: row.saleState,
            eligibleForEditionAllocation: row.eligibleForEditionAllocation,
            editionCount: Number(row.editionCount),
            soldEditionCount: Number(row.soldEditionCount),
          }),
          updatedAt: row.updatedAt.toISOString(),
        })),
        nextCursor:
          hasMore && last
            ? encodeCatalogueCursor({
                createdAt: truncateCatalogueCursorDate(last.updatedAt),
                id: last.id,
              })
            : null,
        counts,
      };
    },

    async getArtwork(artworkId) {
      const [row] = await db
        .select({
          artwork: shopArtwork,
          artistSlug: shopArtist.slug,
          artistArchivedAt: shopArtist.archivedAt,
          artistName: shopParty.displayName,
        })
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtwork.id, artworkId))
        .limit(1);
      if (!row) return null;
      const sourceOriginalId = row.artwork.sourceOriginalArtworkId;
      const [images, editions, sourceOriginal] = await Promise.all([
        db
          .select({ mediaKey: shopArtworkImage.mediaKey, alt: shopArtworkImage.alt })
          .from(shopArtworkImage)
          .where(eq(shopArtworkImage.artworkId, artworkId))
          .orderBy(asc(shopArtworkImage.position)),
        db
          .select({ listingStatus: shopEdition.listingStatus, allocation: shopEdition.allocation })
          .from(shopEdition)
          .where(eq(shopEdition.artworkId, artworkId)),
        sourceOriginalId
          ? db
              .select({
                artworkId: shopArtwork.id,
                slug: shopArtwork.slug,
                title: shopArtwork.title,
              })
              .from(shopArtwork)
              .where(eq(shopArtwork.id, sourceOriginalId))
              .limit(1)
              .then((rows) => rows[0] ?? null)
          : null,
      ]);
      return toAdminArtworkDetail({
        artwork: row.artwork,
        artist: {
          artistId: row.artwork.artistId,
          slug: row.artistSlug,
          displayName: row.artistName,
          archived: row.artistArchivedAt !== null,
        },
        images: images.map((image) => ({ ...image, url: resolveMediaUrl(image.mediaKey) })),
        editions,
        sourceOriginal,
        resolveMediaUrl,
      });
    },
  };
}

type ArtworkRow = typeof shopArtwork.$inferSelect;

export function toAdminArtworkDetail(input: {
  artwork: ArtworkRow;
  artist: AdminArtworkDetail["artist"];
  images: AdminArtworkDetail["images"];
  editions: Parameters<typeof summariseEditionRun>[0];
  sourceOriginal?: AdminArtworkDetail["sourceOriginal"];
  resolveMediaUrl: ResolveMediaUrl;
}): AdminArtworkDetail {
  const { artwork, images } = input;
  const run = summariseEditionRun(input.editions);
  const importedImageUrl =
    images.length === 0 ? input.resolveMediaUrl(artwork.primaryImageUrl) : null;
  return {
    artworkId: artwork.id,
    slug: artwork.slug,
    title: artwork.title,
    artist: input.artist,
    yearCreated: artwork.yearCreated,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    description: artwork.description,
    eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
    printPricePence: artwork.printPricePence,
    saleState: artwork.saleState,
    salesChannel: artwork.salesChannel,
    seoTitle: artwork.seoTitle,
    seoDescription: artwork.seoDescription,
    images,
    importedImageUrl,
    sourceOriginal: input.sourceOriginal ?? null,
    editions: {
      size: run.size,
      committed: run.committed,
      byStatus: run.byStatus,
      byAllocation: run.byAllocation,
    },
    state: artworkCatalogueState({
      publishedAt: artwork.publishedAt,
      archivedAt: artwork.archivedAt,
      saleState: artwork.saleState,
      eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
      editionCount: run.size,
      soldEditionCount: run.byStatus.sold,
    }),
    publishBlockers: artworkPublishBlockers({
      archived: artwork.archivedAt !== null,
      artistArchived: input.artist.archived,
      hasImage: images.length > 0 || importedImageUrl !== null,
      eligibleForEditionAllocation: artwork.eligibleForEditionAllocation,
      saleState: artwork.saleState,
      printPricePence: artwork.printPricePence,
    }),
    publishedAt: artwork.publishedAt?.toISOString() ?? null,
    archivedAt: artwork.archivedAt?.toISOString() ?? null,
    createdAt: artwork.createdAt.toISOString(),
    updatedAt: artwork.updatedAt.toISOString(),
    version: artwork.updatedAt.toISOString(),
  };
}
