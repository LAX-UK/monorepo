import type { Database } from "@auction/db";
import {
  collectionException,
  collectionPlace,
  collectionWeeklyHours,
  lot,
  sale,
} from "@auction/db/schema";
import {
  type CollectionException,
  type CollectionExceptionSource,
  type CollectionWeeklyHours,
  DEFAULT_COLLECTION_WEEKLY_HOURS,
  type DateKey,
} from "@auction/domain";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type {
  CollectionCalendarFacts,
  CollectionPlaceSettings,
  ICollectionPlaceRepository,
} from "../interfaces/collection-booking.repository.js";

type PlaceRow = typeof collectionPlace.$inferSelect;
type ExceptionRow = typeof collectionException.$inferSelect;

function toSettings(row: PlaceRow): CollectionPlaceSettings {
  return {
    venueId: row.venueId,
    onlineBookingEnabled: row.onlineBookingEnabled,
    visitMinutes: row.visitMinutes,
    placesPerSlot: row.placesPerSlot,
    noticeCutoffLocal: row.noticeCutoffLocal,
    noticeWorkingDays: row.noticeWorkingDays,
    windowDays: row.windowDays,
    closeOnSaleDays: row.closeOnSaleDays,
    undoHandOverMinutes: row.undoHandOverMinutes,
    freeStorageDays: row.freeStorageDays,
    bookingEmail: row.bookingEmail,
    updatedAt: row.updatedAt,
  };
}

function toException(row: ExceptionRow): CollectionException {
  return {
    kind: row.kind === "extra_opening" ? "extra_opening" : "closure",
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    opensLocal: row.opensLocal,
    closesLocal: row.closesLocal,
    source: row.source as CollectionExceptionSource,
  };
}

export class DrizzleCollectionPlaceRepository implements ICollectionPlaceRepository {
  constructor(private readonly db: Database) {}

  async find(venueId: string): Promise<CollectionPlaceSettings | null> {
    const [row] = await this.db
      .select()
      .from(collectionPlace)
      .where(eq(collectionPlace.venueId, venueId))
      .limit(1);
    return row ? toSettings(row) : null;
  }

  async findForLot(
    lotId: string,
  ): Promise<{ settings: CollectionPlaceSettings; hours: CollectionWeeklyHours[] } | null> {
    const [row] = await this.db
      .select({ venueId: sale.venueId })
      .from(lot)
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!row?.venueId) return null;
    const settings = await this.find(row.venueId);
    if (!settings) return null;
    return { settings, hours: await this.weeklyHours(row.venueId) };
  }

  private async weeklyHours(venueId: string): Promise<CollectionWeeklyHours[]> {
    const rows = await this.db
      .select()
      .from(collectionWeeklyHours)
      .where(eq(collectionWeeklyHours.venueId, venueId))
      .orderBy(asc(collectionWeeklyHours.weekday), asc(collectionWeeklyHours.opensLocal));
    return rows.map((row) => ({
      weekday: row.weekday,
      opensLocal: row.opensLocal,
      closesLocal: row.closesLocal,
    }));
  }

  async ensure(venueId: string): Promise<CollectionPlaceSettings> {
    // A second caller racing the first waits on the primary key, finds the row and adds nothing.
    await this.db.transaction(async (tx) => {
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
    const settings = await this.find(venueId);
    if (!settings) throw new Error(`Collection place ${venueId} was not created`);
    return settings;
  }

  async readCalendarFacts(
    venueId: string,
    range: { from: DateKey; to: DateKey },
  ): Promise<CollectionCalendarFacts> {
    const settings = await this.ensure(venueId);
    const hours = await this.weeklyHours(venueId);
    const exceptions = await this.db
      .select()
      .from(collectionException)
      .where(
        and(
          eq(collectionException.venueId, venueId),
          isNull(collectionException.deletedAt),
          lte(collectionException.startsOn, range.to),
          gte(collectionException.endsOn, range.from),
        ),
      )
      .orderBy(asc(collectionException.startsOn), asc(collectionException.id));
    return { settings, hours, exceptions: exceptions.map(toException) };
  }
}
