import type { Database } from "@auction/db";
import { shopArtwork, shopOrderLine } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";

/** True when any edition line on the order is flagged as personalised goods. */
export async function orderHasPersonalisedGoods(db: Database, orderId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: shopOrderLine.id })
    .from(shopOrderLine)
    .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
    .where(and(eq(shopOrderLine.orderId, orderId), eq(shopArtwork.isPersonalisedGoods, true)))
    .limit(1);
  return Boolean(row);
}
