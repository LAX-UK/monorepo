import type { Database } from "@auction/db";
import {
  collectionException,
  collectionPlace,
  collectionWeeklyHours,
  venue,
} from "@auction/db/schema";
import {
  type CollectionExceptionSource,
  type CollectionWeeklyHours,
  type DateKey,
  londonDateKey,
  normaliseWeeklyHours,
} from "@auction/domain";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type { CollectionPlaceSettings } from "../interfaces/collection-booking.repository.js";
import type {
  AddCollectionException,
  AddExceptionOutcome,
  CollectionVenueChoice,
  ICollectionSettingsReader,
  ICollectionSettingsWriter,
  RemoveCollectionException,
  RemoveExceptionOutcome,
  SaveCollectionSettings,
  SaveSettingsOutcome,
  SettingsField,
  StaffExceptionRecord,
  StaffSettingsRecord,
  WithinSettingsTransaction,
} from "../interfaces/collection-settings.repository.js";
import { ensureBankHolidays, saleDaysAt } from "./drizzle-collection-closures.js";
import { ensureCollectionPlace } from "./drizzle-collection-place-setup.js";

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

function toStaffException(row: ExceptionRow): StaffExceptionRecord {
  return {
    id: row.id,
    kind: row.kind === "extra_opening" ? "extra_opening" : "closure",
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    opensLocal: row.opensLocal,
    closesLocal: row.closesLocal,
    source: row.source as CollectionExceptionSource,
    reasonInternal: row.reasonInternal,
    saleId: row.saleId,
    saleTitle: null,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

const sameHours = (a: readonly CollectionWeeklyHours[], b: readonly CollectionWeeklyHours[]) =>
  JSON.stringify(normaliseWeeklyHours(a)) === JSON.stringify(normaliseWeeklyHours(b));

/** The settings that differ between what was stored and what is being saved. */
function changedFields(
  before: PlaceRow,
  beforeHours: readonly CollectionWeeklyHours[],
  input: SaveCollectionSettings,
): SettingsField[] {
  const changed: SettingsField[] = [];
  const check = (field: SettingsField, was: unknown, now: unknown) => {
    if (was !== now) changed.push(field);
  };
  check("online_booking_enabled", before.onlineBookingEnabled, input.onlineBookingEnabled);
  check("visit_minutes", before.visitMinutes, input.rules.visitMinutes);
  check("places_per_slot", before.placesPerSlot, input.rules.placesPerSlot);
  check("notice_cutoff", before.noticeCutoffLocal, input.rules.noticeCutoffLocal);
  check("notice_working_days", before.noticeWorkingDays, input.rules.noticeWorkingDays);
  check("window_days", before.windowDays, input.rules.windowDays);
  check("close_on_sale_days", before.closeOnSaleDays, input.rules.closeOnSaleDays);
  check("undo_hand_over_minutes", before.undoHandOverMinutes, input.rules.undoHandOverMinutes);
  check("free_storage_days", before.freeStorageDays, input.freeStorageDays);
  check("booking_email", before.bookingEmail, input.bookingEmail);
  if (!sameHours(beforeHours, input.hours)) changed.push("weekly_hours");
  return changed;
}

export class DrizzleCollectionSettingsRepository
  implements ICollectionSettingsReader, ICollectionSettingsWriter
{
  constructor(private readonly db: Database) {}

  async venues(): Promise<CollectionVenueChoice[]> {
    const rows = await this.db
      .select({
        venueId: venue.id,
        name: venue.name,
        placeVenueId: collectionPlace.venueId,
        enabled: collectionPlace.onlineBookingEnabled,
      })
      .from(venue)
      .leftJoin(collectionPlace, eq(collectionPlace.venueId, venue.id))
      .where(and(eq(venue.status, "active"), isNull(venue.deletedAt)))
      .orderBy(asc(venue.name), asc(venue.id));
    return rows.map((row) => ({
      venueId: row.venueId,
      name: row.name,
      hasPlace: row.placeVenueId !== null,
      onlineBookingEnabled: row.enabled ?? false,
    }));
  }

  async read(
    venueId: string,
    range: { from: DateKey; to: DateKey },
    now: Date = new Date(),
  ): Promise<StaffSettingsRecord | null> {
    const [known] = await this.db
      .select({ id: venue.id })
      .from(venue)
      .where(and(eq(venue.id, venueId), isNull(venue.deletedAt)))
      .limit(1);
    if (!known) return null;

    await ensureCollectionPlace(this.db, venueId);
    await ensureBankHolidays(this.db, venueId, now);
    const [place] = await this.db
      .select()
      .from(collectionPlace)
      .where(eq(collectionPlace.venueId, venueId))
      .limit(1);
    if (!place) throw new Error(`Collection place ${venueId} was not created`);
    const hours = await this.hoursOf(venueId);
    const stored = await this.db
      .select()
      .from(collectionException)
      .where(
        and(
          eq(collectionException.venueId, venueId),
          isNull(collectionException.deletedAt),
          lte(collectionException.startsOn, range.to),
          gte(collectionException.endsOn, range.from),
        ),
      );
    const saleDays = await saleDaysAt(this.db, venueId, range);
    const exceptions: StaffExceptionRecord[] = [
      ...stored.map(toStaffException),
      ...saleDays.map(
        (day): StaffExceptionRecord => ({
          id: null,
          kind: "closure",
          startsOn: day.startsOn,
          endsOn: day.endsOn,
          opensLocal: null,
          closesLocal: null,
          source: "sale",
          reasonInternal: null,
          saleId: day.saleId,
          saleTitle: day.saleTitle,
          createdByUserId: null,
          createdAt: null,
        }),
      ),
    ].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.endsOn.localeCompare(b.endsOn));

    const today = londonDateKey(now);
    const next = exceptions.find((e) => e.source === "sale" && e.endsOn >= today);
    return {
      settings: toSettings(place),
      hours,
      exceptions,
      nextSaleDay:
        next?.saleId && next.saleTitle
          ? { saleId: next.saleId, saleTitle: next.saleTitle, startsOn: next.startsOn }
          : null,
    };
  }

  async save(
    input: SaveCollectionSettings,
    within?: WithinSettingsTransaction<Extract<SaveSettingsOutcome, { outcome: "saved" }>>,
  ): Promise<SaveSettingsOutcome> {
    const [known] = await this.db
      .select({ id: venue.id })
      .from(venue)
      .where(and(eq(venue.id, input.venueId), isNull(venue.deletedAt)))
      .limit(1);
    if (!known) return { outcome: "venue_not_found" };
    await ensureCollectionPlace(this.db, input.venueId);

    return this.db.transaction(async (tx): Promise<SaveSettingsOutcome> => {
      const [row] = await tx
        .select()
        .from(collectionPlace)
        .where(eq(collectionPlace.venueId, input.venueId))
        .for("update")
        .limit(1);
      if (!row) return { outcome: "venue_not_found" };
      if (row.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
        return { outcome: "stale" };
      }
      const beforeHours = await tx
        .select()
        .from(collectionWeeklyHours)
        .where(eq(collectionWeeklyHours.venueId, input.venueId));
      const changed = changedFields(
        row,
        beforeHours.map((h) => ({
          weekday: h.weekday,
          opensLocal: h.opensLocal,
          closesLocal: h.closesLocal,
        })),
        input,
      );

      const [saved] = await tx
        .update(collectionPlace)
        .set({
          onlineBookingEnabled: input.onlineBookingEnabled,
          visitMinutes: input.rules.visitMinutes,
          placesPerSlot: input.rules.placesPerSlot,
          noticeCutoffLocal: input.rules.noticeCutoffLocal,
          noticeWorkingDays: input.rules.noticeWorkingDays,
          windowDays: input.rules.windowDays,
          closeOnSaleDays: input.rules.closeOnSaleDays,
          undoHandOverMinutes: input.rules.undoHandOverMinutes,
          freeStorageDays: input.freeStorageDays,
          bookingEmail: input.bookingEmail,
          updatedByUserId: input.updatedByUserId,
          updatedAt: input.at,
        })
        .where(eq(collectionPlace.venueId, input.venueId))
        .returning();
      if (!saved) return { outcome: "venue_not_found" };

      if (changed.includes("weekly_hours")) {
        await tx
          .delete(collectionWeeklyHours)
          .where(eq(collectionWeeklyHours.venueId, input.venueId));
        const week = normaliseWeeklyHours(input.hours);
        if (week.length > 0) {
          await tx.insert(collectionWeeklyHours).values(
            week.map((h) => ({
              venueId: input.venueId,
              weekday: h.weekday,
              opensLocal: h.opensLocal,
              closesLocal: h.closesLocal,
            })),
          );
        }
      }
      const result = {
        outcome: "saved" as const,
        settings: toSettings(saved),
        hours: normaliseWeeklyHours(input.hours),
        changed,
      };
      await within?.(tx, result);
      return result;
    });
  }

  async addException(
    input: AddCollectionException,
    within?: WithinSettingsTransaction<StaffExceptionRecord>,
  ): Promise<AddExceptionOutcome> {
    const [known] = await this.db
      .select({ id: venue.id })
      .from(venue)
      .where(and(eq(venue.id, input.venueId), isNull(venue.deletedAt)))
      .limit(1);
    if (!known) return { outcome: "venue_not_found" };
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(collectionException)
        .values({
          venueId: input.venueId,
          kind: input.draft.kind,
          startsOn: input.draft.startsOn,
          endsOn: input.draft.endsOn,
          opensLocal: input.draft.opensLocal,
          closesLocal: input.draft.closesLocal,
          source: "staff",
          reasonInternal: input.reasonInternal,
          createdByUserId: input.createdByUserId,
        })
        .returning();
      if (!row) throw new Error("A collection exception was not stored");
      const exception = toStaffException(row);
      await within?.(tx, exception);
      return { outcome: "added" as const, exception };
    });
  }

  async removeException(
    input: RemoveCollectionException,
    within?: WithinSettingsTransaction<StaffExceptionRecord>,
  ): Promise<RemoveExceptionOutcome> {
    return this.db.transaction(async (tx): Promise<RemoveExceptionOutcome> => {
      const [row] = await tx
        .update(collectionException)
        .set({ deletedAt: input.at })
        .where(
          and(
            eq(collectionException.id, input.exceptionId),
            eq(collectionException.venueId, input.venueId),
            isNull(collectionException.deletedAt),
          ),
        )
        .returning();
      if (!row) return { outcome: "not_found" };
      const exception = toStaffException(row);
      await within?.(tx, exception);
      return { outcome: "removed", exception };
    });
  }

  private async hoursOf(venueId: string): Promise<CollectionWeeklyHours[]> {
    const rows = await this.db
      .select()
      .from(collectionWeeklyHours)
      .where(eq(collectionWeeklyHours.venueId, venueId))
      .orderBy(asc(collectionWeeklyHours.weekday), asc(collectionWeeklyHours.opensLocal));
    return rows.map((h) => ({
      weekday: h.weekday,
      opensLocal: h.opensLocal,
      closesLocal: h.closesLocal,
    }));
  }
}
