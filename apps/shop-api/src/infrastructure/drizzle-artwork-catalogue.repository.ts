import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkCategory,
  shopArtworkImage,
  shopCategory,
  shopEdition,
  shopHomePlacement,
  shopMediaAsset,
  shopParty,
} from "@auction/db/schema";
import { maxItemsForPlacement } from "@auction/shop-domain";
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
import {
  type ArtworkCatalogueRow,
  parseDbNumeric,
  toPublicArtworkDetail,
  toPublicArtworkSummary,
} from "./map-public-artwork.js";
import { sellableEditionCountSql } from "./shop-edition-availability.js";
import { publishedHomePlacementForSlot } from "./shop-home-placement-queries.js";

type EditionCounts = { total: number; available: number };

const priceTierSql = sql<number>`CASE WHEN ${shopArtwork.printPricePence} IS NULL THEN 1 ELSE 0 END`;

async function editionCountsByArtworkId(
  db: Database,
  artworkIds: string[],
): Promise<Map<string, EditionCounts>> {
  if (artworkIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      artworkId: shopEdition.artworkId,
      total: count(),
      available: sellableEditionCountSql,
    })
    .from(shopEdition)
    .where(inArray(shopEdition.artworkId, artworkIds))
    .groupBy(shopEdition.artworkId);
  return new Map(
    rows.map((row) => [
      row.artworkId,
      { total: Number(row.total), available: Number(row.available) },
    ]),
  );
}

type SelectedArtworkRow = {
  artworkId: string;
  slug: string;
  title: string;
  description: string | null;
  primaryImageUrl: string | null;
  saleState: "for_sale" | "price_on_application" | "sold";
  dimensions: string | null;
  heightCm: string | null;
  widthCm: string | null;
  depthCm: string | null;
  medium: string | null;
  yearCreated: number | null;
  objectType: ArtworkCatalogueRow["objectType"];
  rarity: ArtworkCatalogueRow["rarity"];
  hasCertificate: boolean;
  provenance: string | null;
  exhibitionHistory: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  salesChannel: "shop" | "art";
  artistName: string;
  artistSlug: string;
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  createdAt: Date;
  placementPosition?: number;
};

type ArtworkCatalogueRepositoryOptions = {
  resolveMediaUrl: (value: string | null | undefined) => string | null;
};

function mapRow(
  row: SelectedArtworkRow,
  editionCounts: Map<string, EditionCounts>,
  images: ArtworkImageReadModel[] = [],
): ArtworkCatalogueRow {
  const counts = editionCounts.get(row.artworkId) ?? { total: 0, available: 0 };
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    primaryImageUrl: row.primaryImageUrl,
    images,
    artistName: row.artistName,
    artistSlug: row.artistSlug,
    saleState: row.saleState,
    dimensions: row.dimensions,
    heightCm: parseDbNumeric(row.heightCm),
    widthCm: parseDbNumeric(row.widthCm),
    depthCm: parseDbNumeric(row.depthCm),
    medium: row.medium,
    yearCreated: row.yearCreated,
    objectType: row.objectType,
    rarity: row.rarity,
    hasCertificate: row.hasCertificate,
    provenance: row.provenance,
    exhibitionHistory: row.exhibitionHistory,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt,
    salesChannel: row.salesChannel,
    eligibleForEditionAllocation: row.eligibleForEditionAllocation,
    printPricePence: row.printPricePence,
    totalEditionCount: counts.total,
    availableEditionCount: counts.available,
  };
}

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

function buildArtworkFilters(filter: NormalizedArtworkCatalogueFilters | undefined): SQL[] {
  const conditions: SQL[] = [];
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
  if (filter.saleState) {
    conditions.push(eq(shopArtwork.saleState, filter.saleState));
  }
  if (filter.salesChannel) {
    conditions.push(eq(shopArtwork.salesChannel, filter.salesChannel));
  }
  if (filter.artistSlugs) {
    conditions.push(inArray(shopArtist.slug, filter.artistSlugs));
  }
  if (filter.categorySlug) {
    conditions.push(eq(shopCategory.slug, filter.categorySlug));
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
  if (filter.objectTypes) {
    conditions.push(inArray(shopArtwork.objectType, filter.objectTypes));
  }
  if (filter.rarities) {
    conditions.push(inArray(shopArtwork.rarity, filter.rarities));
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

      const baseSelect = {
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
        salesChannel: shopArtwork.salesChannel,
        artistName: shopParty.displayName,
        artistSlug: shopArtist.slug,
        eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
        printPricePence: shopArtwork.printPricePence,
        createdAt: shopArtwork.createdAt,
      };

      let rows: SelectedArtworkRow[];
      let totalCount: number | undefined;

      if (placement === "featured_originals" || placement === "featured_prints") {
        let placementQuery = db
          .select({
            ...baseSelect,
            placementPosition: shopHomePlacement.position,
          })
          .from(shopHomePlacement)
          .innerJoin(shopArtwork, eq(shopHomePlacement.artworkId, shopArtwork.id))
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .$dynamic();

        if (filter?.categorySlug) {
          placementQuery = placementQuery
            .innerJoin(shopArtworkCategory, eq(shopArtworkCategory.artworkId, shopArtwork.id))
            .innerJoin(shopCategory, eq(shopArtworkCategory.categoryId, shopCategory.id));
        }

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
        let query = db
          .select(baseSelect)
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .$dynamic();

        let countQuery = db
          .select({ total: count() })
          .from(shopArtwork)
          .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
          .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
          .$dynamic();

        if (filter?.categorySlug) {
          query = query
            .innerJoin(shopArtworkCategory, eq(shopArtworkCategory.artworkId, shopArtwork.id))
            .innerJoin(shopCategory, eq(shopArtworkCategory.categoryId, shopCategory.id));
          countQuery = countQuery
            .innerJoin(shopArtworkCategory, eq(shopArtworkCategory.artworkId, shopArtwork.id))
            .innerJoin(shopCategory, eq(shopArtworkCategory.categoryId, shopCategory.id));
        }

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
      const editionCounts = await editionCountsByArtworkId(
        db,
        page.map((row) => row.artworkId),
      );
      const items = page.map((row) => toPublicArtworkSummary(mapRow(row, editionCounts)));
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
          salesChannel: shopArtwork.salesChannel,
          artistName: shopParty.displayName,
          artistSlug: shopArtist.slug,
          eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
          printPricePence: shopArtwork.printPricePence,
        })
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(eq(shopArtwork.slug, slug))
        .limit(1);
      if (!row) {
        return null;
      }
      const editionCounts = await editionCountsByArtworkId(db, [row.artworkId]);
      const images = await loadArtworkImages(db, row.artworkId, resolveMediaUrl);
      return toPublicArtworkDetail(
        mapRow({ ...row, createdAt: new Date() }, editionCounts, images),
      );
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
        .where(and(eq(shopArtwork.salesChannel, salesChannel), isNotNull(shopArtwork.objectType)))
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
