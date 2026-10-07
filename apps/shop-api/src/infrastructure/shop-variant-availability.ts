import type { Database } from "@auction/db";
import { shopProductVariant } from "@auction/db/schema";
import { inArray, sql } from "drizzle-orm";

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
      sellable: sql<number>`GREATEST(${shopProductVariant.onHand} - ${shopProductVariant.reserved}, 0)`,
    })
    .from(shopProductVariant)
    .where(inArray(shopProductVariant.id, variantIds));
  return new Map(rows.map((row) => [row.id, Number(row.sellable)]));
}
