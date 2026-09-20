import type { Database } from "@auction/db";
import { shopEdition, shopOrder } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

/** Expired reservation TTL only counts as sellable when no pending_payment order still holds the lock. */
const expiredReservationSellableSql = sql`(
  ${shopEdition.status} = 'reserved'
  and ${shopEdition.reservedUntil} is not null
  and ${shopEdition.reservedUntil} < now()
  and (
    ${shopEdition.reservedByOrderId} is null
    or not exists (
      select 1 from ${shopOrder}
      where ${shopOrder.id} = ${shopEdition.reservedByOrderId}
        and ${shopOrder.status} = 'pending_payment'
    )
  )
)`;

const sellableEditionCoreSql = sql`${shopEdition.ownerPartyId} is not null and (${shopEdition.status} = 'available' or ${expiredReservationSellableSql})`;

/** Sellable edition count for notify-me, catalogue, and basket stock checks. */
export const sellableEditionCountSql = sql<number>`count(*) filter (where ${sellableEditionCoreSql})`;

/** Row-level predicate for picking a sellable edition at checkout. */
export function sellableEditionCondition() {
  return and(
    isNotNull(shopEdition.ownerPartyId),
    or(eq(shopEdition.status, "available"), expiredReservationSellableCondition()),
  );
}

function expiredReservationSellableCondition() {
  return and(
    eq(shopEdition.status, "reserved"),
    isNotNull(shopEdition.reservedUntil),
    sql`${shopEdition.reservedUntil} < now()`,
    or(
      sql`${shopEdition.reservedByOrderId} is null`,
      sql`not exists (
        select 1 from ${shopOrder}
        where ${shopOrder.id} = ${shopEdition.reservedByOrderId}
          and ${shopOrder.status} = 'pending_payment'
      )`,
    ),
  );
}

export async function sellableCountsByArtworkIds(
  db: Database,
  artworkIds: string[],
): Promise<Map<string, number>> {
  if (artworkIds.length === 0) return new Map();
  const rows = await db
    .select({
      artworkId: shopEdition.artworkId,
      available: sellableEditionCountSql,
    })
    .from(shopEdition)
    .where(inArray(shopEdition.artworkId, artworkIds))
    .groupBy(shopEdition.artworkId);
  return new Map(rows.map((row) => [row.artworkId, Number(row.available ?? 0)]));
}

export async function countSellableForArtwork(db: Database, artworkId: string): Promise<number> {
  const map = await sellableCountsByArtworkIds(db, [artworkId]);
  return map.get(artworkId) ?? 0;
}
