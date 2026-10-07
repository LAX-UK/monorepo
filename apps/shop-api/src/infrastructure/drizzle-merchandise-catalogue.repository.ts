import type { Database } from "@auction/db";
import { shopProduct, shopProductVariant } from "@auction/db/schema";
import { and, asc, eq, gt, min, sql } from "drizzle-orm";
import { encodeCatalogueCursor } from "../application/catalogue-cursor.js";
import type { MerchandiseCatalogueReader } from "../application/ports/merchandise-catalogue.reader.js";
import { MAX_PUBLIC_MERCH_LIMIT } from "../application/ports/merchandise-catalogue.reader.js";
import { keysetBeforeCreatedAtId, orderByMsTimestampIdDesc } from "./admin-created-at-keyset.js";

function availableStockSql() {
  return sql`${shopProductVariant.onHand} - ${shopProductVariant.reserved}`;
}

export function createDrizzleMerchandiseCatalogueRepository(
  db: Database,
): MerchandiseCatalogueReader {
  return {
    async listPublicProducts(input) {
      const limit = Math.min(Math.max(input.limit, 1), MAX_PUBLIC_MERCH_LIMIT);
      const cursor = input.cursor ?? null;
      const availableStock = availableStockSql();
      const rows = await db
        .select({
          id: shopProduct.id,
          slug: shopProduct.slug,
          title: shopProduct.title,
          createdAt: shopProduct.createdAt,
          fromPricePence: min(shopProductVariant.pricePence),
        })
        .from(shopProduct)
        .innerJoin(shopProductVariant, eq(shopProductVariant.productId, shopProduct.id))
        .where(
          and(
            gt(availableStock, 0),
            cursor
              ? keysetBeforeCreatedAtId(shopProduct.createdAt, shopProduct.id, cursor)
              : undefined,
          ),
        )
        .groupBy(shopProduct.id, shopProduct.slug, shopProduct.title, shopProduct.createdAt)
        .orderBy(...orderByMsTimestampIdDesc(shopProduct.createdAt, shopProduct.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page.at(-1);
      return {
        items: page.map((row) => ({
          slug: row.slug,
          title: row.title,
          fromPricePence: Number(row.fromPricePence),
        })),
        ...(hasMore && last
          ? { nextCursor: encodeCatalogueCursor({ createdAt: last.createdAt, id: last.id }) }
          : {}),
      };
    },

    async getPublicProductBySlug(slug) {
      const [product] = await db
        .select({
          slug: shopProduct.slug,
          title: shopProduct.title,
          description: shopProduct.description,
        })
        .from(shopProduct)
        .where(eq(shopProduct.slug, slug))
        .limit(1);
      if (!product) {
        return null;
      }
      const availableStock = availableStockSql();
      const variants = await db
        .select({
          variantId: shopProductVariant.id,
          sku: shopProductVariant.sku,
          pricePence: shopProductVariant.pricePence,
          availableCount: availableStock,
        })
        .from(shopProductVariant)
        .innerJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
        .where(and(eq(shopProduct.slug, slug), gt(availableStock, 0)))
        .orderBy(asc(shopProductVariant.sku));
      if (variants.length === 0) {
        return null;
      }
      return {
        slug: product.slug,
        title: product.title,
        description: product.description,
        variants: variants.map((row) => ({
          variantId: row.variantId,
          sku: row.sku,
          pricePence: row.pricePence,
          availableCount: Number(row.availableCount),
        })),
      };
    },
  };
}
