import type { Database } from "@auction/db";
import { shopProduct, shopProductVariant } from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

/** Units that can still be sold; an archived product or variant has none, whatever its stock. */
export async function sellableCountsByVariantIds(
  db: Database,
  variantIds: string[],
): Promise<Map<string, number>> {
  if (variantIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      id: shopProductVariant.id,
      sellable: sql<number>`CASE
        WHEN ${shopProductVariant.archivedAt} IS NOT NULL OR ${shopProduct.archivedAt} IS NOT NULL THEN 0
        ELSE GREATEST(${shopProductVariant.onHand} - ${shopProductVariant.reserved}, 0)
      END`,
    })
    .from(shopProductVariant)
    .innerJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
    .where(inArray(shopProductVariant.id, variantIds));
  return new Map(rows.map((row) => [row.id, Number(row.sellable)]));
}
