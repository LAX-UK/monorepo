import type { Database } from "@auction/db";
import { collectionPlace, venue } from "@auction/db/schema";
import { type StorageTerms, formatStorageTerms, londonDateKey } from "@auction/domain";
import type { StorageTermsRecord } from "@auction/persistence/interfaces";
import { DrizzleCollectionStorageRepository } from "@auction/persistence/repositories";
import { asc, eq } from "drizzle-orm";

/** A collection place and the storage terms a buyer reads for it, in one sentence. */
export type PlaceStorageTermsDto = { placeName: string; text: string };

/** The stored version as the storage rules read it. */
export function storageTermsOfRecord(record: StorageTermsRecord): StorageTerms {
  return {
    freeDays: record.freeDays,
    dayCount: record.countMode,
    standardDailyPence: record.standardDailyPence,
    largeDailyPence: record.largeDailyPence,
    handlingFeePence: record.handlingFeePence,
    effectiveFrom: record.effectiveFrom,
  };
}

/** What a buyer reads about the terms in force at one place today; `null` when none are set. */
export async function storageTermsTextForVenue(
  db: Database,
  venueId: string,
  now: Date,
): Promise<string | null> {
  const record = await new DrizzleCollectionStorageRepository(db).findTermsInForce(
    venueId,
    londonDateKey(now),
  );
  return record ? formatStorageTerms(storageTermsOfRecord(record)) : null;
}

/** The terms in force today at every place that takes bookings, for the shipping page. */
export async function listPlaceStorageTerms(
  db: Database,
  now: Date,
): Promise<PlaceStorageTermsDto[]> {
  const places = await db
    .select({ venueId: collectionPlace.venueId, placeName: venue.name })
    .from(collectionPlace)
    .innerJoin(venue, eq(venue.id, collectionPlace.venueId))
    .where(eq(collectionPlace.onlineBookingEnabled, true))
    .orderBy(asc(venue.name));
  const texts = await Promise.all(
    places.map((place) => storageTermsTextForVenue(db, place.venueId, now)),
  );
  return places.flatMap((place, i) => {
    const text = texts[i];
    return text ? [{ placeName: place.placeName, text }] : [];
  });
}
