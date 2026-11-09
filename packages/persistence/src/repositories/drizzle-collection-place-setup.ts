import type { Database } from "@auction/db";
import { collectionPlace, collectionWeeklyHours } from "@auction/db/schema";
import { DEFAULT_COLLECTION_WEEKLY_HOURS } from "@auction/domain";

/**
 * Sets a venue up for collections the first time anything needs it: a place with the gallery's
 * rules (online booking off) and its opening hours. Safe to call from many requests at once: a
 * second caller waits on the primary key, finds the row and adds nothing.
 */
export async function ensureCollectionPlace(db: Database, venueId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(collectionPlace)
      .values({ venueId })
      .onConflictDoNothing()
      .returning({ venueId: collectionPlace.venueId });
    if (!created) return;
    await tx.insert(collectionWeeklyHours).values(
      DEFAULT_COLLECTION_WEEKLY_HOURS.map((hours) => ({
        venueId,
        weekday: hours.weekday,
        opensLocal: hours.opensLocal,
        closesLocal: hours.closesLocal,
      })),
    );
  });
}
