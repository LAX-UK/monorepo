import type { Database } from "@auction/db";
import {
  collectionBookingLot,
  collectionPlace,
  lot,
  lotFulfilment,
  sale,
  venue,
} from "@auction/db/schema";
import { and, asc, eq, gte, isNotNull, notExists, or, sql } from "drizzle-orm";
import type { ICollectByReader, StoredLot } from "../interfaces/collect-by.reader.js";

/** Reads the purchased lots waiting at places that are set up for collection. */
export class DrizzleCollectByReader implements ICollectByReader {
  constructor(private readonly db: Database) {}

  async storedLotsClearedSince(since: Date): Promise<StoredLot[]> {
    const rows = await this.db
      .select({
        lotId: lot.id,
        legalEntityId: lot.buyerLegalEntityId,
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
          gte(lotFulfilment.paymentClearedAt, since),
          isNotNull(lot.buyerLegalEntityId),
          eq(lot.status, "ended"),
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
}
