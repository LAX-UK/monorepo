import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkCategory,
  shopCategory,
  shopEdition,
  shopHomePlacement,
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
  or,
  sql,
} from "drizzle-orm";
import type { ArtworkListCursor } from "../application/artwork-catalogue-cursor.js";
import type { NormalizedArtworkCatalogueFilters } from "../application/artwork-catalogue-filters.js";
import { DEFAULT_ARTWORK_CATALOGUE_SORT } from "../application/artwork-catalogue-sort.js";
import type {
  ArtworkCatalogueReader,
  ListPublicArtworksInput,
  ListPublicArtworksResult,
} from "../application/ports/artwork-catalogue.reader.js";
import {
  type ArtworkCatalogueRow,
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
  yearCreated: number | null;
  artistName: string;
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  createdAt: Date;
  placementPosition?: number;
};

function mapRow(
  row: SelectedArtworkRow,
  editionCounts: Map<string, EditionCounts>,
): ArtworkCatalogueRow {
  const counts = editionCounts.get(row.artworkId) ?? { total: 0, available: 0 };
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    primaryImageUrl: row.primaryImageUrl,
    artistName: row.artistName,
    saleState: row.saleState,
    dimensions: row.dimensions,
    yearCreated: row.yearCreated,
    eligibleForEditionAllocation: row.eligibleForEditionAllocation,
    printPricePence: row.printPricePence,
    totalEditionCount: counts.total,
    availableEditionCount: counts.available,
  };
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
  if (filter.artistSlug) {
    conditions.push(eq(shopArtist.slug, filter.artistSlug));
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

export function createDrizzleArtworkCatalogueRepository(db: Database): ArtworkCatalogueReader {
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
        yearCreated: shopArtwork.yearCreated,
        artistName: shopParty.displayName,
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
          yearCreated: shopArtwork.yearCreated,
          artistName: shopParty.displayName,
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
      return toPublicArtworkDetail(mapRow({ ...row, createdAt: new Date() }, editionCounts));
    },
  };
}
