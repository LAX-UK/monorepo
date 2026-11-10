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
import { MAX_FREE_STORAGE_DAYS } from "@auction/domain";
import { and, asc, eq, isNotNull, isNull, like, notExists, or, sql } from "drizzle-orm";
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
          // A range on the column itself, so the index can narrow the lots before the exact
          // London-day test: from the start of the day the longest free period ago to the end of today.
          sql`${lotFulfilment.paymentClearedAt} >= (${window.today}::date - ${MAX_FREE_STORAGE_DAYS}::int)::timestamp at time zone ${LONDON}`,
          sql`${lotFulfilment.paymentClearedAt} < (${window.today}::date + 1)::timestamp at time zone ${LONDON}`,
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

  async remindedLotIds(query: {
    keyPrefix: string;
    userId: string;
    today: string;
  }): Promise<Set<string>> {
    // The prefix is built from ids and a fixed word, never typed text, but `%` and `_` would still
    // be wildcards, so they are escaped. The person and the template narrow the rows to the
    // person's own reminders by an indexed column, before the key is compared.
    const pattern = `${query.keyPrefix.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await this.db
      .select({ vars: emailOutbox.vars })
      .from(emailOutbox)
      .where(
        and(
          eq(emailOutbox.userId, query.userId),
          eq(emailOutbox.template, "collection-collect-by"),
          like(emailOutbox.idempotencyKey, pattern),
          // A failed row is tried again on a later day: only today's counts as covering its lots.
          or(
            sql`${emailOutbox.status} <> 'failed'`,
            sql`(${emailOutbox.createdAt} at time zone ${LONDON})::date = ${query.today}::date`,
          ),
        ),
      );
    const ids = new Set<string>();
    for (const row of rows) {
      const lotIds = (row.vars as { lotIds?: unknown } | null)?.lotIds;
      if (Array.isArray(lotIds)) for (const id of lotIds) if (typeof id === "string") ids.add(id);
    }
    return ids;
  }
}
