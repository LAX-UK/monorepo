import type { Database } from "@auction/db";
import { collectionBookingLot, lot, lotFulfilment, sale } from "@auction/db/schema";
import { type SQL, and, eq, isNull, notExists, or, sql } from "drizzle-orm";

/**
 * The SQL of the domain's `awaitsCollection` for a purchased lot, the one place it is written for
 * the reminder sweep and the staff Not collected tab: the lot and its sale are live, not handed
 * over, ended or on its way by courier, and not in a live booking (a booked lot is on the Upcoming
 * tab). Callers add their own place and payment-cleared conditions. The query must join
 * `lot_fulfilment`, `lot` and `sale`.
 */
export function lotAwaitsCollectionSql(db: Database): SQL {
  return and(
    isNull(lot.deletedAt),
    isNull(sale.deletedAt),
    sql`${lotFulfilment.status} not in ('awaiting_payment', 'delivered', 'cancelled', 'in_transit')`,
    or(
      sql`${lotFulfilment.fulfilmentMethod} is null`,
      sql`${lotFulfilment.fulfilmentMethod} <> 'shipping'`,
    ),
    notExists(
      db
        .select({ one: collectionBookingLot.lotId })
        .from(collectionBookingLot)
        .where(and(eq(collectionBookingLot.lotId, lot.id), eq(collectionBookingLot.active, true))),
    ),
  ) as SQL;
}
