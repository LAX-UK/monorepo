import type { Database } from "@auction/db";
import { shopArtworkCategory, shopCategory, shopHomePlacement } from "@auction/db/schema";
import { maxItemsForPlacement } from "@auction/shop-domain";
import { and, asc, count, eq, gt, inArray, or } from "drizzle-orm";
import type { SortLabelCursor } from "../application/catalogue-cursor.js";
import type {
  CategoryCatalogueReader,
  ListPublicCategoriesInput,
} from "../application/ports/category-catalogue.reader.js";
import { toPublicCategorySummary } from "./map-public-category.js";
import { publishedHomePlacementForSlot } from "./shop-home-placement-queries.js";

async function artworkCountByCategoryId(
  db: Database,
  categoryIds: string[],
): Promise<Map<string, number>> {
  if (categoryIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      categoryId: shopArtworkCategory.categoryId,
      artworkCount: count(),
    })
    .from(shopArtworkCategory)
    .where(inArray(shopArtworkCategory.categoryId, categoryIds))
    .groupBy(shopArtworkCategory.categoryId);
  return new Map(rows.map((row) => [row.categoryId, row.artworkCount]));
}

export function createDrizzleCategoryCatalogueRepository(db: Database): CategoryCatalogueReader {
  return {
    async listPublicCategories(input: ListPublicCategoriesInput) {
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
          .where(publishedHomePlacementForSlot("featured_categories"))
          .orderBy(asc(shopHomePlacement.position))
          .limit(Math.min(input.limit, maxItemsForPlacement("featured_categories")));
        const counts = await artworkCountByCategoryId(
          db,
          rows.map((row) => row.id),
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
        .where(cursor ? afterCursor(cursor) : undefined)
        .orderBy(asc(shopCategory.sortOrder), asc(shopCategory.label), asc(shopCategory.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const counts = await artworkCountByCategoryId(
        db,
        page.map((row) => row.id),
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
      const counts = await artworkCountByCategoryId(db, [row.id]);
      return toPublicCategorySummary({
        slug: row.slug,
        label: row.label,
        coverImageUrl: row.coverImageUrl,
        artworkCount: counts.get(row.id) ?? 0,
      });
    },
  };
}
