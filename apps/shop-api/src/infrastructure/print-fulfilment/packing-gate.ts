import type { Database } from "@auction/db";
import { shopEdition, shopEditionFacts, shopOrderLine } from "@auction/db/schema";
import { linesBlockingDispatch } from "@auction/shop-domain";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

/**
 * The order lines whose numbered print has not been confirmed at packing. An order leaves packing
 * only when this is empty, so no numbered print ships unchecked.
 */
export async function linesAwaitingPackConfirmation(
  db: Database,
  orderId: string,
): Promise<string[]> {
  const rows = await db
    .select({
      orderLineId: shopOrderLine.id,
      packConfirmedAt: shopOrderLine.packConfirmedAt,
      numbering: shopEditionFacts.numbering,
    })
    .from(shopOrderLine)
    .innerJoin(shopEdition, eq(shopEdition.id, shopOrderLine.editionId))
    .leftJoin(shopEditionFacts, eq(shopEditionFacts.artworkId, shopEdition.artworkId))
    .where(
      and(
        eq(shopOrderLine.orderId, orderId),
        isNotNull(shopOrderLine.editionId),
        isNull(shopOrderLine.releasedAt),
      ),
    );
  return linesBlockingDispatch(
    rows.map((row) => ({
      orderLineId: row.orderLineId,
      numbered: row.numbering !== null && row.numbering !== "none",
      packConfirmed: row.packConfirmedAt !== null,
    })),
  );
}
