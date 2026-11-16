import type { Database } from "@auction/db";
import { collectionPlace, venue } from "@auction/db/schema";
import { type StorageTerms, formatStorageTerms, londonDateKey } from "@auction/domain";
import type {
  ICollectionStorageRepository,
  StorageTermsRecord,
} from "@auction/persistence/interfaces";
import { asc, eq } from "drizzle-orm";

/** What the public reads need of the stored terms: the version in force on a London day. */
export type StorageTermsInForce = Pick<ICollectionStorageRepository, "findTermsInForce">;

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

/**
 * What a buyer reads about the terms in force at one place; `null` when none are set. `closesAt` is
 * when an open sale ends: a lot is sold under the terms in force on that London day (ST9), so a
 * scheduled change that starts before then is the one the page states. Without it, today's.
 */
export async function storageTermsTextForVenue(
  terms: StorageTermsInForce,
  venueId: string,
  now: Date,
  closesAt?: Date | null,
): Promise<string | null> {
  const day = londonDateKey(closesAt && closesAt > now ? closesAt : now);
  const record = await terms.findTermsInForce(venueId, day);
  return record ? formatStorageTerms(storageTermsOfRecord(record)) : null;
}

/** The terms in force today at every place that takes bookings, for the shipping page. */
export async function listPlaceStorageTerms(
  db: Database,
  terms: StorageTermsInForce,
  now: Date,
): Promise<PlaceStorageTermsDto[]> {
  const places = await db
    .select({ venueId: collectionPlace.venueId, placeName: venue.name })
    .from(collectionPlace)
    .innerJoin(venue, eq(venue.id, collectionPlace.venueId))
    .where(eq(collectionPlace.onlineBookingEnabled, true))
    .orderBy(asc(venue.name));
  const texts = await Promise.all(
    places.map((place) => storageTermsTextForVenue(terms, place.venueId, now)),
  );
  return places.flatMap((place, i) => {
    const text = texts[i];
    return text ? [{ placeName: place.placeName, text }] : [];
  });
}
