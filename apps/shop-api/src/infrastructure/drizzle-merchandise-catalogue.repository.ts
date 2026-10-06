import type { Database } from "@auction/db";
import { shopProduct, shopProductVariant } from "@auction/db/schema";
import { asc, eq, gt, min, sql } from "drizzle-orm";
import type { MerchandiseCatalogueReader } from "../application/ports/merchandise-catalogue.reader.js";

export function createDrizzleMerchandiseCatalogueRepository(
  db: Database,
): MerchandiseCatalogueReader {
  return {
    async listPublicProducts() {
      const availableStock = sql`${shopProductVariant.onHand} - ${shopProductVariant.reserved}`;
      const rows = await db
        .select({
          slug: shopProduct.slug,
          title: shopProduct.title,
          fromPricePence: min(shopProductVariant.pricePence),
        })
        .from(shopProduct)
        .innerJoin(shopProductVariant, eq(shopProductVariant.productId, shopProduct.id))
        .where(gt(availableStock, 0))
        .groupBy(shopProduct.id, shopProduct.slug, shopProduct.title)
        .orderBy(asc(shopProduct.title));

      return {
        items: rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          fromPricePence: Number(row.fromPricePence),
        })),
      };
    },
  };
}
