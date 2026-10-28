import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopArtworkCategory,
  shopCategory,
  shopHomePlacement,
} from "@auction/db/schema";
import { maxItemsForPlacement } from "@auction/shop-domain";
import { type SQL, and, asc, count, eq, exists, gt, inArray, or, sql } from "drizzle-orm";
import type { SortLabelCursor } from "../application/catalogue-cursor.js";
import type {
  CategoryCatalogueReader,
  CategorySalesChannel,
  ListPublicCategoriesInput,
} from "../application/ports/category-catalogue.reader.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import { toPublicCategorySummary } from "./map-public-category.js";
import { listedOnSalesChannelSql } from "./sales-channel-listing-sql.js";
import { publishedHomePlacementForSlot } from "./shop-home-placement-queries.js";

/** A live artwork the channel lists: published, not archived, and of the channel's kind. */
function liveChannelArtwork(channel: CategorySalesChannel): SQL[] {
  return [listedOnSalesChannelSql(channel), publicArtworkVisible()];
}

/** The outer category has at least one live artwork in the channel. */
function categoryHasLiveChannelArtwork(db: Database, channel: CategorySalesChannel): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(shopArtworkCategory)
      .innerJoin(shopArtwork, eq(shopArtworkCategory.artworkId, shopArtwork.id))
      .where(
        and(eq(shopArtworkCategory.categoryId, shopCategory.id), ...liveChannelArtwork(channel)),
      ),
  );
}

async function artworkCountByCategoryId(
  db: Database,
  categoryIds: string[],
  channel: CategorySalesChannel | undefined,
): Promise<Map<string, number>> {
  if (categoryIds.length === 0) {
    return new Map();
  }
  const inCategories = inArray(shopArtworkCategory.categoryId, categoryIds);
  const rows = channel
    ? await db
        .select({ categoryId: shopArtworkCategory.categoryId, artworkCount: count() })
        .from(shopArtworkCategory)
        .innerJoin(shopArtwork, eq(shopArtworkCategory.artworkId, shopArtwork.id))
        .where(and(inCategories, ...liveChannelArtwork(channel)))
        .groupBy(shopArtworkCategory.categoryId)
    : await db
        .select({ categoryId: shopArtworkCategory.categoryId, artworkCount: count() })
        .from(shopArtworkCategory)
        .where(inCategories)
        .groupBy(shopArtworkCategory.categoryId);
  return new Map(rows.map((row) => [row.categoryId, row.artworkCount]));
}

export function createDrizzleCategoryCatalogueRepository(db: Database): CategoryCatalogueReader {
  return {
    async listPublicCategories(input: ListPublicCategoriesInput) {
      const channel = input.salesChannel;
      const channelFilter = channel ? categoryHasLiveChannelArtwork(db, channel) : undefined;
      if (input.placement === "featured_categories") {
        const rows = await db
          .select({
            id: shopCategory.id,
            slug: shopCategory.slug,
            label: shopCategory.label,
            coverImageUrl: shopCategory.coverImageUrl,
          })
          .from(shopHomePlacement)
          .innerJoin(shopCategory, eq(shopHomePlacement.categoryId, shopCategory.id))
          .where(and(publishedHomePlacementForSlot("featured_categories"), channelFilter))
          .orderBy(asc(shopHomePlacement.position))
          .limit(Math.min(input.limit, maxItemsForPlacement("featured_categories")));
        const counts = await artworkCountByCategoryId(
          db,
          rows.map((row) => row.id),
          channel,
        );
        return {
          items: rows.map((row) =>
            toPublicCategorySummary({
              slug: row.slug,
              label: row.label,
              coverImageUrl: row.coverImageUrl,
              artworkCount: counts.get(row.id) ?? 0,
            }),
          ),
        };
      }

      const limit = Math.min(input.limit, 50);
      const cursor = input.cursor ?? null;
      const afterCursor = (value: SortLabelCursor) =>
        or(
          gt(shopCategory.sortOrder, value.sortOrder),
          and(eq(shopCategory.sortOrder, value.sortOrder), gt(shopCategory.label, value.label)),
          and(
            eq(shopCategory.sortOrder, value.sortOrder),
            eq(shopCategory.label, value.label),
            gt(shopCategory.id, value.id),
          ),
        );

      const rows = await db
        .select({
          id: shopCategory.id,
          slug: shopCategory.slug,
          label: shopCategory.label,
          coverImageUrl: shopCategory.coverImageUrl,
          sortOrder: shopCategory.sortOrder,
        })
        .from(shopCategory)
        .where(and(cursor ? afterCursor(cursor) : undefined, channelFilter))
        .orderBy(asc(shopCategory.sortOrder), asc(shopCategory.label), asc(shopCategory.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const counts = await artworkCountByCategoryId(
        db,
        page.map((row) => row.id),
        channel,
      );
      const items = page.map((row) =>
        toPublicCategorySummary({
          slug: row.slug,
          label: row.label,
          coverImageUrl: row.coverImageUrl,
          artworkCount: counts.get(row.id) ?? 0,
        }),
      );
      const last = page.at(-1);
      if (hasMore && last) {
        return {
          items,
          nextCursor: { sortOrder: last.sortOrder, label: last.label, id: last.id },
        };
      }
      return { items };
    },

    async getPublicCategoryBySlug(slug: string) {
      const rows = await db
        .select({
          id: shopCategory.id,
          slug: shopCategory.slug,
          label: shopCategory.label,
          coverImageUrl: shopCategory.coverImageUrl,
        })
        .from(shopCategory)
        .where(eq(shopCategory.slug, slug))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const counts = await artworkCountByCategoryId(db, [row.id], undefined);
      return toPublicCategorySummary({
        slug: row.slug,
        label: row.label,
        coverImageUrl: row.coverImageUrl,
        artworkCount: counts.get(row.id) ?? 0,
      });
    },
  };
}
