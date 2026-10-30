import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkCategory,
  shopArtworkImage,
  shopCategory,
  shopHomePlacement,
  shopMediaAsset,
  shopParty,
} from "@auction/db/schema";
import {
  CATALOGUE_PRICE_BANDS,
  CATALOGUE_SIZE_BANDS,
  type CatalogueBandRange,
  catalogueSizeBandRange,
  maxItemsForPlacement,
} from "@auction/shop-domain";
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { ArtworkListCursor } from "../application/artwork-catalogue-cursor.js";
import {
  ARTWORK_OBJECT_TYPES,
  type NormalizedArtworkCatalogueFilters,
} from "../application/artwork-catalogue-filters.js";
import { DEFAULT_ARTWORK_CATALOGUE_SORT } from "../application/artwork-catalogue-sort.js";
import type {
  ArtworkCatalogueReader,
  ListPublicArtworksInput,
  ListPublicArtworksResult,
} from "../application/ports/artwork-catalogue.reader.js";
import type { ArtworkImageReadModel } from "../application/read-models/catalogue.read-model.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import { toPublicArtworkDetail } from "./map-public-artwork.js";
import {
  type SelectedArtworkRow,
  editionCountsByArtworkId,
  publicArtworkColumns,
  toArtworkCatalogueRow,
  toPublicArtworkSummaries,
} from "./public-artwork-rows.js";
import { listedOnSalesChannelSql } from "./sales-channel-listing-sql.js";
import { artworkAvailableNowSql } from "./shop-edition-availability.js";
import { publishedHomePlacementForSlot } from "./shop-home-placement-queries.js";

const priceTierSql = sql<number>`CASE WHEN ${shopArtwork.printPricePence} IS NULL THEN 1 ELSE 0 END`;

/** The longest side of the image in cm; null unless both height and width are positive. */
const longestSideCmSql = sql<number | null>`CASE
  WHEN ${shopArtwork.heightCm} > 0 AND ${shopArtwork.widthCm} > 0
  THEN greatest(${shopArtwork.heightCm}, ${shopArtwork.widthCm})
END`;

/** The catalogued medium, trimmed; the technique filter and its counts both read it. */
const techniqueSql = sql<string | null>`nullif(btrim(${shopArtwork.medium}), '')`;

/** `value` within a half-open catalogue band (`from` included, `below` excluded). */
function inBandSql(value: SQL, range: CatalogueBandRange): SQL {
  const parts: SQL[] = [sql`${value} IS NOT NULL`];
  if (range.from !== undefined) parts.push(sql`${value} >= ${range.from}`);
  if (range.below !== undefined) parts.push(sql`${value} < ${range.below}`);
  return and(...parts) as SQL;
}

type ArtworkCatalogueRepositoryOptions = {
  resolveMediaUrl: (value: string | null | undefined) => string | null;
};

async function loadArtworkImages(
  db: Database,
  artworkId: string,
  resolveMediaUrl: ArtworkCatalogueRepositoryOptions["resolveMediaUrl"],
): Promise<ArtworkImageReadModel[]> {
  const rows = await db
    .select({
      mediaKey: shopArtworkImage.mediaKey,
      alt: shopArtworkImage.alt,
      caption: shopArtworkImage.caption,
      blurDataUrl: shopMediaAsset.blurDataUrl,
    })
    .from(shopArtworkImage)
    .leftJoin(shopMediaAsset, eq(shopArtworkImage.mediaKey, shopMediaAsset.key))
    .where(eq(shopArtworkImage.artworkId, artworkId))
    .orderBy(asc(shopArtworkImage.position));
  return rows
    .map((row) => {
      const url = resolveMediaUrl(row.mediaKey);
      if (!url) return null;
      return {
        url,
        alt: row.alt,
        caption: row.caption,
        blurDataUrl: row.blurDataUrl,
      };
    })
    .filter((row): row is ArtworkImageReadModel => row !== null);
}

/**
 * The original's slug while lax.art shows it (published, not archived, on the lax.art channel),
 * so the storefront never links to a page that is not there.
 */
async function loadLinkableOriginalSlug(db: Database, artworkId: string): Promise<string | null> {
  const [original] = await db
    .select({ slug: shopArtwork.slug })
    .from(shopArtwork)
    .where(
      and(eq(shopArtwork.id, artworkId), listedOnSalesChannelSql("art"), publicArtworkVisible()),
    )
    .limit(1);
  return original?.slug ?? null;
}

function buildArtworkFilters(filter: NormalizedArtworkCatalogueFilters | undefined): SQL[] {
  const conditions: SQL[] = [publicArtworkVisible()];
  if (!filter) {
    return conditions;
  }
  if (filter.artworkType === "original") {
    conditions.push(eq(shopArtwork.eligibleForEditionAllocation, false));
  } else if (filter.artworkType === "edition") {
    conditions.push(eq(shopArtwork.eligibleForEditionAllocation, true));
  } else if (filter.editionEligible !== undefined) {
    conditions.push(eq(shopArtwork.eligibleForEditionAllocation, filter.editionEligible));
  }
  if (filter.saleState === "available") {
    conditions.push(inArray(shopArtwork.saleState, ["for_sale", "price_on_application"]));
  } else if (filter.saleState) {
    conditions.push(eq(shopArtwork.saleState, filter.saleState));
  }
  if (filter.availability === "available") {
    conditions.push(artworkAvailableNowSql);
  } else if (filter.availability === "sold_out") {
    conditions.push(sql`not ${artworkAvailableNowSql}`);
  }
  if (filter.salesChannel) {
    conditions.push(listedOnSalesChannelSql(filter.salesChannel));
  }
  if (filter.artistSlugs) {
    conditions.push(inArray(shopArtist.slug, filter.artistSlugs));
  }
  if (filter.categorySlug) {
    // A subquery rather than a join, so an artwork in several categories is never counted twice.
    conditions.push(
      sql`exists (
        select 1 from ${shopArtworkCategory}
        inner join ${shopCategory} on ${shopCategory.id} = ${shopArtworkCategory.categoryId}
        where ${shopArtworkCategory.artworkId} = ${shopArtwork.id}
          and ${shopCategory.slug} = ${filter.categorySlug}
      )`,
    );
  }
  if (filter.minPricePence !== undefined) {
    conditions.push(
      and(
        isNotNull(shopArtwork.printPricePence),
        gte(shopArtwork.printPricePence, filter.minPricePence),
      ) as SQL,
    );
  }
  if (filter.maxPricePence !== undefined) {
    conditions.push(
      and(
        isNotNull(shopArtwork.printPricePence),
        lte(shopArtwork.printPricePence, filter.maxPricePence),
      ) as SQL,
    );
  }
  if (filter.sizeBand) {
    conditions.push(inBandSql(longestSideCmSql, catalogueSizeBandRange(filter.sizeBand)));
  }
  if (filter.technique) {
    conditions.push(sql`lower(${techniqueSql}) = lower(${filter.technique})`);
  }
  if (filter.objectTypes) {
    conditions.push(inArray(shopArtwork.objectType, filter.objectTypes));
  }
  if (filter.rarities) {
    conditions.push(inArray(shopArtwork.rarity, filter.rarities));
  }
  if (filter.sourceOriginalSlug) {
    conditions.push(
      sql`${shopArtwork.sourceOriginalArtworkId} = (
        SELECT id FROM shop_artwork WHERE slug = ${filter.sourceOriginalSlug} LIMIT 1
      )`,
    );
  }
  if (filter.relatedToSlug) {
    conditions.push(
      sql`${shopArtwork.id} IN (
        SELECT ac2.artwork_id FROM shop_artwork_category ac2
        WHERE ac2.category_id IN (
          SELECT ac.category_id FROM shop_artwork_category ac
          INNER JOIN shop_artwork anchor ON anchor.id = ac.artwork_id
          WHERE anchor.slug = ${filter.relatedToSlug}
        )
        AND ac2.artwork_id <> (
          SELECT id FROM shop_artwork WHERE slug = ${filter.relatedToSlug} LIMIT 1
        )
      )`,
    );
  }
  const textQuery = filter.q?.trim();
  if (textQuery && textQuery.length > 0) {
    const pattern = `%${textQuery}%`;
    conditions.push(
      or(
        ilike(shopArtwork.title, pattern),
        ilike(shopArtwork.slug, pattern),
        ilike(shopParty.displayName, pattern),
      ) as SQL,
    );
  }
  return conditions;
}

function cursorPredicate(cursor: ArtworkListCursor): SQL {
  switch (cursor.sort) {
    case "newest":
      return or(
        lt(shopArtwork.createdAt, cursor.createdAt),
        and(eq(shopArtwork.createdAt, cursor.createdAt), lt(shopArtwork.id, cursor.id)),
      ) as SQL;
    case "titleAsc":
      return or(
        gt(shopArtwork.title, cursor.title),
        and(eq(shopArtwork.title, cursor.title), gt(shopArtwork.id, cursor.id)),
      ) as SQL;
    case "priceAsc":
      return or(
        gt(priceTierSql, cursor.priceTier),
        and(eq(priceTierSql, cursor.priceTier), gt(shopArtwork.printPricePence, cursor.pricePence)),
        and(
          eq(priceTierSql, cursor.priceTier),
          eq(shopArtwork.printPricePence, cursor.pricePence),
          gt(shopArtwork.id, cursor.id),
        ),
      ) as SQL;
    case "priceDesc":
      return or(
        gt(priceTierSql, cursor.priceTier),
        and(eq(priceTierSql, cursor.priceTier), lt(shopArtwork.printPricePence, cursor.pricePence)),
        and(
          eq(priceTierSql, cursor.priceTier),
          eq(shopArtwork.printPricePence, cursor.pricePence),
          lt(shopArtwork.id, cursor.id),
        ),
      ) as SQL;
  }
}

function orderByForSort(sort: NormalizedArtworkCatalogueFilters["sort"]) {
  switch (sort) {
    case "titleAsc":
      return [asc(shopArtwork.title), asc(shopArtwork.id)];
    case "priceAsc":
      return [asc(priceTierSql), asc(shopArtwork.printPricePence), asc(shopArtwork.id)];
    case "priceDesc":
      return [asc(priceTierSql), desc(shopArtwork.printPricePence), desc(shopArtwork.id)];
    default:
      return [desc(shopArtwork.createdAt), desc(shopArtwork.id)];
  }
}

function nextCursorForRow(
  row: SelectedArtworkRow,
  sort: NormalizedArtworkCatalogueFilters["sort"],
): ArtworkListCursor {
  switch (sort) {
    case "titleAsc":
      return { sort: "titleAsc", title: row.title, id: row.artworkId };
    case "priceAsc":
    case "priceDesc":
      return {
        sort,
        priceTier: row.printPricePence === null ? 1 : 0,
        pricePence: row.printPricePence ?? 0,
        id: row.artworkId,
      };
    default:
      return { sort: "newest", createdAt: row.createdAt, id: row.artworkId };
  }
}

export function createDrizzleArtworkCatalogueRepository(
  db: Database,
  options: ArtworkCatalogueRepositoryOptions = {
    resolveMediaUrl: (value) => value ?? null,
  },
): ArtworkCatalogueReader {
  const { resolveMediaUrl } = options;
  return {
    async listPublicArtworks(input: ListPublicArtworksInput): Promise<ListPublicArtworksResult> {
      const filter = input.filter;
      const placement = filter?.placement;
      const placementCap = placement ? maxItemsForPlacement(placement) : null;
      const limit = Math.min(Math.max(input.limit, 1), placementCap ?? 50);
      const cursor = input.cursor;
      const sort = filter?.sort ?? DEFAULT_ARTWORK_CATALOGUE_SORT;
      const conditions = buildArtworkFilters(filter);

      let rows: SelectedArtworkRow[];
      let totalCount: number | undefined;

      if (placement === "featured_originals" || placement === "featured_prints") {
        const placementQuery = db
          .select({
            ...publicArtworkColumns,
            placementPosition: shopHomePlacement.position,
          })
          .from(shopHomePlacement)
          .innerJoin(shopArtwork, eq(shopHomePlacement.artworkId, shopArtwork.id))
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .$dynamic();

        rows = await placementQuery
          .where(
            and(
              publishedHomePlacementForSlot(placement),
              ...(placement === "featured_prints"
                ? [eq(shopArtwork.eligibleForEditionAllocation, true)]
                : []),
              ...(placement === "featured_originals"
                ? [
                    eq(shopArtwork.eligibleForEditionAllocation, false),
                    ne(shopArtwork.saleState, "sold"),
                  ]
                : []),
              ...conditions,
            ),
          )
          .orderBy(asc(shopHomePlacement.position))
          .limit(limit);
      } else {
        const query = db
          .select(publicArtworkColumns)
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .$dynamic();

        const countQuery = db
          .select({ total: count() })
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .$dynamic();

        const whereParts = [...conditions];
        if (cursor) {
          whereParts.push(cursorPredicate(cursor));
        }
        const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

        const [countRow] = await countQuery.where(whereClause ? and(...conditions) : undefined);
        totalCount = Number(countRow?.total ?? 0);

        rows = await query
          .where(whereClause)
          .orderBy(...orderByForSort(sort))
          .limit(limit + 1);
      }

      const hasMore = placement ? false : rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const items = await toPublicArtworkSummaries(db, page, resolveMediaUrl);
      const last = page.at(-1);
      if (hasMore && last) {
        return {
          items,
          nextCursor: nextCursorForRow(last, sort),
          ...(totalCount !== undefined ? { totalCount } : {}),
        };
      }
      return {
        items,
        ...(totalCount !== undefined ? { totalCount } : {}),
      };
    },

    async getPublicArtworkBySlug(slug: string) {
      const [row] = await db
        .select({
          artworkId: shopArtwork.id,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
          description: shopArtwork.description,
          primaryImageUrl: shopArtwork.primaryImageUrl,
          saleState: shopArtwork.saleState,
          dimensions: shopArtwork.dimensions,
          heightCm: shopArtwork.heightCm,
          widthCm: shopArtwork.widthCm,
          depthCm: shopArtwork.depthCm,
          medium: shopArtwork.medium,
          yearCreated: shopArtwork.yearCreated,
          objectType: shopArtwork.objectType,
          rarity: shopArtwork.rarity,
          hasCertificate: shopArtwork.hasCertificate,
          provenance: shopArtwork.provenance,
          exhibitionHistory: shopArtwork.exhibitionHistory,
          seoTitle: shopArtwork.seoTitle,
          seoDescription: shopArtwork.seoDescription,
          updatedAt: shopArtwork.updatedAt,
          createdAt: shopArtwork.createdAt,
          salesChannel: shopArtwork.salesChannel,
          artistName: shopParty.displayName,
          artistSlug: shopArtist.slug,
          eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
          printPricePence: shopArtwork.printPricePence,
          printPaper: shopArtwork.printPaper,
          printSize: shopArtwork.printSize,
          sourceOriginalArtworkId: shopArtwork.sourceOriginalArtworkId,
        })
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(and(eq(shopArtwork.slug, slug), publicArtworkVisible()))
        .limit(1);
      if (!row) {
        return null;
      }
      const { printPaper, printSize, sourceOriginalArtworkId, ...selected } = row;
      const [editionCounts, images, sourceOriginalSlug] = await Promise.all([
        editionCountsByArtworkId(db, [row.artworkId]),
        loadArtworkImages(db, row.artworkId, resolveMediaUrl),
        sourceOriginalArtworkId ? loadLinkableOriginalSlug(db, sourceOriginalArtworkId) : null,
      ]);
      return toPublicArtworkDetail({
        ...toArtworkCatalogueRow(selected, editionCounts, resolveMediaUrl, images),
        printPaper,
        printSize,
        sourceOriginalSlug,
      });
    },

    async countFacets(filter) {
      const { availability: _availability, ...availabilityScope } = filter;
      const { categorySlug: _category, ...categoryScope } = filter;
      const { artistSlugs: _artists, ...artistScope } = filter;
      const { minPricePence: _min, maxPricePence: _max, ...priceScope } = filter;
      const { sizeBand: _size, ...sizeScope } = filter;
      const { technique: _technique, ...techniqueScope } = filter;
      const bandCounts = (
        value: SQL,
        bands: ReadonlyArray<{ key: string; range: CatalogueBandRange }>,
        scope: NormalizedArtworkCatalogueFilters,
      ) =>
        db
          .select(
            Object.fromEntries(
              bands.map((band) => [
                band.key,
                sql<number>`count(*) filter (where ${inBandSql(value, band.range)})`,
              ]),
            ),
          )
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .where(and(...buildArtworkFilters(scope)));
      const priceBands = CATALOGUE_PRICE_BANDS.map((band) => ({
        key: band.key,
        range: band.pence,
      }));
      const sizeBands = CATALOGUE_SIZE_BANDS.map((band) => ({
        key: band.key,
        range: band.longestSideCm,
      }));
      const [availabilityRows, categoryRows, artistRows, priceRows, sizeRows, techniqueRows] =
        await Promise.all([
          db
            .select({
              total: count(),
              available: sql<number>`count(*) filter (where ${artworkAvailableNowSql})`,
            })
            .from(shopArtwork)
            .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
            .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
            .where(and(...buildArtworkFilters(availabilityScope))),
          db
            .select({ slug: shopCategory.slug, label: shopCategory.label, count: count() })
            .from(shopArtwork)
            .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
            .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
            .innerJoin(shopArtworkCategory, eq(shopArtworkCategory.artworkId, shopArtwork.id))
            .innerJoin(shopCategory, eq(shopArtworkCategory.categoryId, shopCategory.id))
            .where(and(...buildArtworkFilters(categoryScope)))
            .groupBy(shopCategory.slug, shopCategory.label, shopCategory.sortOrder)
            .orderBy(asc(shopCategory.sortOrder), asc(shopCategory.label)),
          db
            .select({ slug: shopArtist.slug, name: shopParty.displayName, count: count() })
            .from(shopArtwork)
            .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
            .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
            .where(and(...buildArtworkFilters(artistScope)))
            .groupBy(shopArtist.slug, shopParty.displayName)
            .orderBy(asc(shopParty.displayName)),
          bandCounts(sql`${shopArtwork.printPricePence}`, priceBands, priceScope),
          bandCounts(longestSideCmSql, sizeBands, sizeScope),
          db
            .select({ value: sql<string>`${techniqueSql}`, count: count() })
            .from(shopArtwork)
            .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
            .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
            .where(and(...buildArtworkFilters(techniqueScope), sql`${techniqueSql} IS NOT NULL`))
            .groupBy(techniqueSql)
            .orderBy(desc(count()), asc(techniqueSql)),
        ]);
      const total = Number(availabilityRows[0]?.total ?? 0);
      const available = Number(availabilityRows[0]?.available ?? 0);
      const bandRow = (
        rows: ReadonlyArray<Record<string, unknown>>,
        bands: ReadonlyArray<{ key: string }>,
      ) => bands.map((band) => ({ key: band.key, count: Number(rows[0]?.[band.key] ?? 0) }));
      return {
        availability: { available, soldOut: total - available },
        categories: categoryRows.map((row) => ({ ...row, count: Number(row.count) })),
        artists: artistRows.map((row) => ({ ...row, count: Number(row.count) })),
        priceBands: bandRow(priceRows, priceBands),
        sizes: bandRow(sizeRows, sizeBands),
        techniques: techniqueRows.map((row) => ({ value: row.value, count: Number(row.count) })),
      };
    },

    async listObjectTypeFacets({ salesChannel }) {
      const rows = await db
        .select({
          objectType: shopArtwork.objectType,
          artworkCount: count(),
          coverImageUrl: sql<
            string | null
          >`(array_agg(${shopArtwork.primaryImageUrl} ORDER BY ${shopArtwork.createdAt} DESC) FILTER (WHERE ${shopArtwork.primaryImageUrl} IS NOT NULL))[1]`,
        })
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            listedOnSalesChannelSql(salesChannel),
            isNotNull(shopArtwork.objectType),
            publicArtworkVisible(),
          ),
        )
        .groupBy(shopArtwork.objectType);
      const byType = new Map(rows.map((row) => [row.objectType, row]));
      return ARTWORK_OBJECT_TYPES.flatMap((objectType) => {
        const row = byType.get(objectType);
        if (!row || Number(row.artworkCount) < 1) return [];
        return [
          {
            objectType,
            artworkCount: Number(row.artworkCount),
            coverImageUrl: resolveMediaUrl(row.coverImageUrl),
          },
        ];
      });
    },
  };
}
