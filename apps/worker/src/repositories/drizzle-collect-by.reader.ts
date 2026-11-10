import type { Database } from "@auction/db";
import {
  collectionBookingLot,
  collectionPlace,
  emailOutbox,
  lot,
  lotFulfilment,
  sale,
  venue,
} from "@auction/db/schema";
import { and, asc, eq, inArray, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";
import type { ICollectByReader, StoredLot } from "../interfaces/collect-by.reader.js";

const LONDON = "Europe/London";

/** Reads the purchased lots waiting at places that are set up for collection. */
export class DrizzleCollectByReader implements ICollectByReader {
  constructor(private readonly db: Database) {}

  async storedLotsDue(window: {
    today: string;
    defaultFreeStorageDays: number;
    reminderLeadDays: number;
  }): Promise<StoredLot[]> {
    const free = sql`coalesce(${collectionPlace.freeStorageDays}, ${window.defaultFreeStorageDays}::int)`;
    // The London day payment cleared, between the free period ago and the free period less the
    // lead ago; with no early reminder (a free period no longer than the lead), the one day.
    const clearedOn = sql`(${lotFulfilment.paymentClearedAt} at time zone ${LONDON})::date`;
    const first = sql`${window.today}::date - ${free}`;
    const last = sql`${window.today}::date - (case when ${free} > ${window.reminderLeadDays}::int then ${free} - ${window.reminderLeadDays}::int else ${free} end)`;
    const rows = await this.db
      .select({
        lotId: lot.id,
        legalEntityId: lot.buyerLegalEntityId,
        venueId: venue.id,
        winnerId: lot.winnerId,
        title: lot.title,
        lotNumber: lot.lotNumber,
        clearedAt: lotFulfilment.paymentClearedAt,
        placeName: venue.name,
        line1: venue.addressLine1,
        line2: venue.addressLine2,
        city: venue.city,
        postcode: venue.postcode,
        freeStorageDays: collectionPlace.freeStorageDays,
      })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lot.id, lotFulfilment.lotId))
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .innerJoin(collectionPlace, eq(collectionPlace.venueId, sale.venueId))
      .innerJoin(venue, eq(venue.id, sale.venueId))
      .where(
        and(
          // Places that take no online booking have nothing to book, so no reminder to book.
          eq(collectionPlace.onlineBookingEnabled, true),
          isNotNull(lotFulfilment.paymentClearedAt),
          sql`${clearedOn} between ${first} and ${last}`,
          isNotNull(lot.buyerLegalEntityId),
          eq(lot.status, "ended"),
          isNull(lot.deletedAt),
          isNull(sale.deletedAt),
          sql`${lotFulfilment.status} not in ('awaiting_payment', 'delivered', 'cancelled', 'in_transit')`,
          or(
            sql`${lotFulfilment.fulfilmentMethod} is null`,
            sql`${lotFulfilment.fulfilmentMethod} <> 'shipping'`,
          ),
          notExists(
            this.db
              .select({ one: collectionBookingLot.lotId })
              .from(collectionBookingLot)
              .where(
                and(eq(collectionBookingLot.lotId, lot.id), eq(collectionBookingLot.active, true)),
              ),
          ),
        ),
      )
      .orderBy(asc(lotFulfilment.paymentClearedAt), asc(lot.id));
    return rows.flatMap((row) =>
      row.legalEntityId && row.clearedAt
        ? [
            {
              lotId: row.lotId,
              legalEntityId: row.legalEntityId,
              venueId: row.venueId,
              winnerId: row.winnerId,
              title: row.title,
              lotNumber: row.lotNumber,
              clearedAt: row.clearedAt,
              place: {
                name: row.placeName,
                address: [row.line1, row.line2, row.city, row.postcode]
                  .filter((part): part is string => Boolean(part?.trim()))
                  .join(", "),
              },
              freeStorageDays: row.freeStorageDays,
            },
          ]
        : [],
    );
  }

  async queuedKeys(keys: readonly string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows = await this.db
      .select({ key: emailOutbox.idempotencyKey })
      .from(emailOutbox)
      .where(inArray(emailOutbox.idempotencyKey, [...keys]));
    return new Set(rows.map((row) => row.key));
  }
}
