import type { Database } from "@auction/db";
import { collectionPlace, emailOutbox, lot, lotFulfilment, sale, venue } from "@auction/db/schema";
import { lotAwaitsCollectionSql, readWaitingLotStorage } from "@auction/persistence/lib";
import { type SQL, and, asc, eq, gte, isNotNull, like, or, sql } from "drizzle-orm";
import type {
  CollectionLotEmailTemplate,
  ICollectByReader,
  StoredLot,
} from "../interfaces/collect-by.reader.js";

const LONDON = "Europe/London";

/** Reads the purchased lots waiting at places that are set up for collection. */
export class DrizzleCollectByReader implements ICollectByReader {
  constructor(private readonly db: Database) {}

  async withAccountLock<T>(
    legalEntityId: string,
    work: () => Promise<T>,
  ): Promise<{ ran: true; value: T } | { ran: false }> {
    // The lock lives as long as this transaction, which only holds it: the work reads and queues
    // on its own connections, and a crash frees the lock with the connection.
    return this.db.transaction(async (tx) => {
      const rows = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtextextended(${`collect-by:${legalEntityId}`}, 0)) as locked`,
      );
      const first = (
        Array.isArray(rows) ? rows : (rows as { rows: { locked: boolean }[] }).rows
      )[0];
      if (first?.locked !== true) return { ran: false as const };
      return { ran: true as const, value: await work() };
    });
  }

  async storedLotsWaiting(query: { today: string }): Promise<StoredLot[]> {
    const lots = await this.waitingLots([
      isNotNull(lotFulfilment.paymentClearedAt),
      sql`${lotFulfilment.paymentClearedAt} < (${query.today}::date + 1)::timestamp at time zone ${LONDON}`,
    ]);
    const storage = await readWaitingLotStorage(
      this.db,
      lots.map(({ stored, storageTermsId, large }) => ({
        lotId: stored.lotId,
        venueId: stored.venueId,
        buyerLegalEntityId: stored.legalEntityId,
        clearedAt: stored.clearedAt,
        storageTermsId,
        large,
      })),
    );
    return lots.map(({ stored }) => ({ ...stored, storage: storage.get(stored.lotId) }));
  }

  async lotsClearedSince(since: Date): Promise<StoredLot[]> {
    const lots = await this.waitingLots([
      isNotNull(lotFulfilment.paymentClearedAt),
      gte(lotFulfilment.paymentClearedAt, since),
    ]);
    return lots.map(({ stored }) => stored);
  }

  /**
   * Purchased lots still waiting at a place that takes online bookings, narrowed by `when`: not
   * handed over, ended or on their way by courier, nor in a live booking.
   */
  private async waitingLots(
    when: SQL[],
  ): Promise<{ stored: StoredLot; storageTermsId: string | null; large: boolean }[]> {
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
        contactPhone: venue.contactPhone,
        bookingEmail: collectionPlace.bookingEmail,
        storageTermsId: lotFulfilment.storageTermsId,
        large: lot.storageLarge,
      })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lot.id, lotFulfilment.lotId))
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .innerJoin(collectionPlace, eq(collectionPlace.venueId, sale.venueId))
      .innerJoin(venue, eq(venue.id, sale.venueId))
      .where(
        and(
          // Places that take no online booking have nothing to book, so no email to book.
          eq(collectionPlace.onlineBookingEnabled, true),
          ...when,
          isNotNull(lot.buyerLegalEntityId),
          eq(lot.status, "ended"),
          // The domain's `awaitsCollection` (with online booking above), shared with the staff
          // Not collected tab; the integration test checks it against the domain case by case.
          lotAwaitsCollectionSql(this.db),
        ),
      )
      .orderBy(asc(lotFulfilment.paymentClearedAt), asc(lot.id));
    return rows.flatMap((row) =>
      row.legalEntityId && row.clearedAt
        ? [
            {
              storageTermsId: row.storageTermsId,
              large: row.large,
              stored: {
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
                  bookingEmail: row.bookingEmail,
                  phone: row.contactPhone?.trim() || null,
                },
              },
            },
          ]
        : [],
    );
  }

  async remindedLotIds(query: {
    keyPrefix: string;
    userId: string;
    today: string;
    template?: CollectionLotEmailTemplate;
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
          eq(emailOutbox.template, query.template ?? "collection-collect-by"),
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
