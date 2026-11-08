import {
  type AffectedBooking,
  type AffectedHandling,
  COLLECTION_BOOKING_EVENT_AGGREGATE,
  COLLECTION_PLACE_EVENT_AGGREGATE,
  type CollectionConfiguration,
  type CollectionException,
  type CollectionRules,
  type CollectionSettingsEvent,
  addDaysToKey,
  bookingsAffectedBy,
  collectionBookingCancelled,
  collectionExceptionChanged,
  collectionPlaceUpdated,
  collectionRulesIssues,
  exceptionDraftIssues,
  londonDateKey,
  weeklyHoursIssues,
} from "@auction/domain";
import type {
  CollectionBookingRecord,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionSettingsReader,
  ICollectionSettingsWriter,
  StaffExceptionRecord,
  StaffSettingsRecord,
} from "@auction/persistence/interfaces";
import type {
  StaffAffectedBooking,
  StaffCollectionChangeResult,
  StaffCollectionException,
  StaffCollectionSettings,
  StaffCollectionVenue,
} from "@auction/types";
import type {
  AddCollectionExceptionBody,
  AffectedBookingsChoice,
  RemoveCollectionExceptionBody,
  SaveCollectionSettingsBody,
} from "@auction/validators";
import { err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  CollectionSettingsActor,
  ICollectionSettingsAdminService,
} from "../interfaces/collection-settings-service.js";
import { type CollectionSettingsResult, settingsError } from "./collection-settings.errors.js";

/** How far ahead closures and bookings are read: past the longest booking window. */
const HORIZON_DAYS = 400;
const DAY_MS = 24 * 60 * 60_000;

export type CollectionSettingsDeps = {
  settings: ICollectionSettingsReader & ICollectionSettingsWriter;
  bookings: ICollectionBookingReader & Pick<ICollectionBookingWriter, "cancel">;
  events: IDomainEventSink;
  now: () => Date;
};

type Why = "hours_changed" | "closure_added" | "opening_removed";

export class CollectionSettingsAdminService implements ICollectionSettingsAdminService {
  constructor(private readonly deps: CollectionSettingsDeps) {}

  async venues(): Promise<StaffCollectionVenue[]> {
    return this.deps.settings.venues();
  }

  async get(venueId: string): Promise<CollectionSettingsResult<StaffCollectionSettings>> {
    const record = await this.read(venueId);
    return record ? ok(toSettingsView(record)) : err(settingsError("venue_not_found"));
  }

  async save(
    actor: CollectionSettingsActor,
    venueId: string,
    body: SaveCollectionSettingsBody,
  ): Promise<CollectionSettingsResult<StaffCollectionChangeResult>> {
    const rules: CollectionRules = {
      visitMinutes: body.visitMinutes,
      placesPerSlot: body.placesPerSlot,
      noticeCutoffLocal: body.noticeCutoffLocal,
      noticeWorkingDays: body.noticeWorkingDays,
      windowDays: body.windowDays,
      closeOnSaleDays: body.closeOnSaleDays,
      undoHandOverMinutes: body.undoHandOverMinutes,
    };
    const hoursIssues = weeklyHoursIssues(body.hours);
    const rulesIssues = collectionRulesIssues(rules);
    if (hoursIssues.length > 0 || rulesIssues.length > 0) {
      return err(
        settingsError("settings_invalid", {
          issues: {
            ...(hoursIssues.length > 0 ? { hours: hoursIssues } : {}),
            ...(rulesIssues.length > 0 ? { rules: rulesIssues } : {}),
          },
        }),
      );
    }

    const current = await this.read(venueId);
    if (!current) return err(settingsError("venue_not_found"));
    if (current.settings.updatedAt.toISOString() !== new Date(body.version).toISOString()) {
      return err(settingsError("settings_changed"));
    }

    const now = this.deps.now();
    const live = await this.liveBookings(venueId, now);
    const before = bookingsAffectedBy(live.map(liveOf), configurationOf(current));
    const after = bookingsAffectedBy(
      live.map(liveOf),
      configurationOf(current, {
        hours: body.hours,
        rules: { closeOnSaleDays: body.closeOnSaleDays, placesPerSlot: body.placesPerSlot },
      }),
    );
    const newly = newlyAffected(before, after);
    const refusal = this.needsChoice(newly, live, body.affectedBookings);
    if (refusal) return err(refusal);
    const handling = handlingOf(newly, body.affectedBookings);

    const outcome = await this.deps.settings.save(
      {
        venueId,
        expectedUpdatedAt: new Date(body.version),
        rules,
        onlineBookingEnabled: body.onlineBookingEnabled,
        bookingEmail: body.bookingEmail,
        freeStorageDays: body.freeStorageDays,
        hours: body.hours,
        updatedByUserId: actor.userId,
        at: now,
      },
      (tx, saved) =>
        this.record(
          tx,
          actor,
          COLLECTION_PLACE_EVENT_AGGREGATE,
          venueId,
          collectionPlaceUpdated({
            venueId,
            changed: saved.changed,
            affectedBookings: newly.length,
            affectedHandling: handling,
          }),
        ),
    );
    if (outcome.outcome === "venue_not_found") return err(settingsError("venue_not_found"));
    if (outcome.outcome === "stale") return err(settingsError("settings_changed"));

    const cancelled =
      handling === "cancel_and_rebook"
        ? await this.cancelAffected(actor, newly, live, "hours_changed", now)
        : 0;
    return ok(await this.result(venueId, newly, live, cancelled));
  }

  async addException(
    actor: CollectionSettingsActor,
    venueId: string,
    body: AddCollectionExceptionBody,
  ): Promise<CollectionSettingsResult<StaffCollectionChangeResult>> {
    const draft = {
      kind: body.kind,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      opensLocal: body.opensLocal,
      closesLocal: body.closesLocal,
    };
    const issues = exceptionDraftIssues(draft);
    const now = this.deps.now();
    if (issues.length === 0 && draft.endsOn < londonDateKey(now)) issues.push("date_invalid");
    if (issues.length > 0)
      return err(settingsError("exception_invalid", { issues: { exception: issues } }));

    const current = await this.read(venueId);
    if (!current) return err(settingsError("venue_not_found"));

    const live = await this.liveBookings(venueId, now);
    const before = bookingsAffectedBy(live.map(liveOf), configurationOf(current));
    const after = bookingsAffectedBy(
      live.map(liveOf),
      configurationOf(current, { extraException: { ...draft, source: "staff" } }),
    );
    const newly = newlyAffected(before, after);
    const refusal = this.needsChoice(newly, live, body.affectedBookings);
    if (refusal) return err(refusal);
    const handling = handlingOf(newly, body.affectedBookings);

    const outcome = await this.deps.settings.addException(
      { venueId, draft, reasonInternal: body.reason ?? null, createdByUserId: actor.userId },
      (tx, added) =>
        this.record(
          tx,
          actor,
          COLLECTION_PLACE_EVENT_AGGREGATE,
          venueId,
          exceptionEvent("collection.exception.added", venueId, added, newly.length, handling),
        ),
    );
    if (outcome.outcome === "venue_not_found") return err(settingsError("venue_not_found"));

    const cancelled =
      handling === "cancel_and_rebook"
        ? await this.cancelAffected(actor, newly, live, "closure_added", now)
        : 0;
    return ok(await this.result(venueId, newly, live, cancelled));
  }

  async removeException(
    actor: CollectionSettingsActor,
    venueId: string,
    exceptionId: string,
    body: RemoveCollectionExceptionBody,
  ): Promise<CollectionSettingsResult<StaffCollectionChangeResult>> {
    const current = await this.read(venueId);
    if (!current) return err(settingsError("venue_not_found"));
    const target = current.exceptions.find((e) => e.id === exceptionId);
    if (!target) return err(settingsError("exception_not_found"));

    const now = this.deps.now();
    const live = await this.liveBookings(venueId, now);
    const before = bookingsAffectedBy(live.map(liveOf), configurationOf(current));
    const after = bookingsAffectedBy(
      live.map(liveOf),
      configurationOf(current, { without: exceptionId }),
    );
    const newly = newlyAffected(before, after);
    const refusal = this.needsChoice(newly, live, body.affectedBookings);
    if (refusal) return err(refusal);
    const handling = handlingOf(newly, body.affectedBookings);

    const outcome = await this.deps.settings.removeException(
      { venueId, exceptionId, at: now },
      (tx, removed) =>
        this.record(
          tx,
          actor,
          COLLECTION_PLACE_EVENT_AGGREGATE,
          venueId,
          exceptionEvent("collection.exception.removed", venueId, removed, newly.length, handling),
        ),
    );
    if (outcome.outcome === "not_found") return err(settingsError("exception_not_found"));

    const cancelled =
      handling === "cancel_and_rebook"
        ? await this.cancelAffected(actor, newly, live, "opening_removed", now)
        : 0;
    return ok(await this.result(venueId, newly, live, cancelled));
  }

  // ---- internals ----------------------------------------------------------------------------

  private async read(venueId: string): Promise<StaffSettingsRecord | null> {
    const now = this.deps.now();
    const today = londonDateKey(now);
    return this.deps.settings.read(
      venueId,
      { from: today, to: addDaysToKey(today, HORIZON_DAYS) },
      now,
    );
  }

  private async liveBookings(venueId: string, now: Date): Promise<CollectionBookingRecord[]> {
    const bookings = await this.deps.bookings.listInRange(venueId, {
      from: now,
      to: new Date(now.getTime() + HORIZON_DAYS * DAY_MS),
    });
    return bookings.filter((booking) => booking.status === "booked");
  }

  /** The refusal to send when a change leaves bookings outside the offer and staff have not chosen. */
  private needsChoice(
    newly: readonly AffectedBooking[],
    live: readonly CollectionBookingRecord[],
    choice: AffectedBookingsChoice | undefined,
  ) {
    if (newly.length === 0 || choice !== undefined) return null;
    return settingsError("bookings_affected", { affected: affectedViews(newly, live) });
  }

  private async cancelAffected(
    actor: CollectionSettingsActor,
    affected: readonly AffectedBooking[],
    live: readonly CollectionBookingRecord[],
    why: Why,
    at: Date,
  ): Promise<number> {
    let cancelled = 0;
    for (const item of affected) {
      const booking = live.find((b) => b.id === item.bookingId);
      if (!booking) continue;
      const outcome = await this.deps.bookings.cancel(
        {
          bookingId: booking.id,
          expectedSequence: booking.icsSequence,
          cancelledByUserId: actor.userId,
          at,
        },
        (tx, done) =>
          this.record(
            tx,
            actor,
            COLLECTION_BOOKING_EVENT_AGGREGATE,
            done.id,
            collectionBookingCancelled(done, "staff", why),
          ),
      );
      // A booking someone changed or cancelled a moment ago is left as it now stands.
      if (outcome.outcome === "cancelled") cancelled += 1;
    }
    return cancelled;
  }

  private async record(
    tx: Parameters<IDomainEventSink["withTx"]>[0],
    actor: CollectionSettingsActor,
    aggregateType: string,
    aggregateId: string,
    event: CollectionSettingsEvent | ReturnType<typeof collectionBookingCancelled>,
  ): Promise<void> {
    await this.deps.events.withTx(tx).publish({
      aggregateType,
      aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: actor.userId,
    });
  }

  private async result(
    venueId: string,
    newly: readonly AffectedBooking[],
    live: readonly CollectionBookingRecord[],
    cancelled: number,
  ): Promise<StaffCollectionChangeResult> {
    const fresh = await this.read(venueId);
    if (!fresh) throw new Error(`Collection place ${venueId} disappeared after a change`);
    return { settings: toSettingsView(fresh), affected: affectedViews(newly, live), cancelled };
  }
}

// ---- pure helpers ---------------------------------------------------------------------------

const liveOf = (booking: CollectionBookingRecord) => ({
  id: booking.id,
  reference: booking.reference,
  slotStart: booking.slotStart,
  slotEnd: booking.slotEnd,
  seat: booking.seat,
  overCapacity: booking.overCapacity,
});

const asException = (e: StaffExceptionRecord): CollectionException => ({
  kind: e.kind,
  startsOn: e.startsOn,
  endsOn: e.endsOn,
  opensLocal: e.opensLocal,
  closesLocal: e.closesLocal,
  source: e.source,
});

/** The place as it stands, or as it would stand with one change applied. */
function configurationOf(
  record: StaffSettingsRecord,
  change: {
    hours?: SaveCollectionSettingsBody["hours"];
    rules?: Pick<CollectionRules, "closeOnSaleDays" | "placesPerSlot">;
    extraException?: CollectionException;
    without?: string;
  } = {},
): CollectionConfiguration {
  const exceptions = record.exceptions
    .filter((e) => e.id === null || e.id !== change.without)
    .map(asException);
  if (change.extraException) exceptions.push(change.extraException);
  return {
    hours: change.hours ?? record.hours,
    exceptions,
    rules: change.rules ?? {
      closeOnSaleDays: record.settings.closeOnSaleDays,
      placesPerSlot: record.settings.placesPerSlot,
    },
  };
}

/** Bookings the change newly puts outside the offer; ones that were already outside are not its doing. */
function newlyAffected(
  before: readonly AffectedBooking[],
  after: readonly AffectedBooking[],
): AffectedBooking[] {
  const already = new Set(before.map((b) => b.bookingId));
  return after.filter((b) => !already.has(b.bookingId));
}

function handlingOf(
  newly: readonly AffectedBooking[],
  choice: AffectedBookingsChoice | undefined,
): AffectedHandling {
  return newly.length === 0 || choice === undefined ? "none" : choice;
}

function affectedViews(
  affected: readonly AffectedBooking[],
  live: readonly CollectionBookingRecord[],
): StaffAffectedBooking[] {
  return affected.flatMap((item) => {
    const booking = live.find((b) => b.id === item.bookingId);
    return booking
      ? [
          {
            bookingId: booking.id,
            reference: booking.reference,
            start: booking.slotStart.toISOString(),
            end: booking.slotEnd.toISOString(),
            reason: item.reason,
          },
        ]
      : [];
  });
}

function exceptionEvent(
  eventType: "collection.exception.added" | "collection.exception.removed",
  venueId: string,
  exception: StaffExceptionRecord,
  affectedBookings: number,
  affectedHandling: AffectedHandling,
): CollectionSettingsEvent {
  return collectionExceptionChanged(eventType, {
    venueId,
    exceptionId: exception.id ?? "",
    kind: exception.kind,
    source: exception.source,
    startsOn: exception.startsOn,
    endsOn: exception.endsOn,
    opensLocal: exception.opensLocal,
    closesLocal: exception.closesLocal,
    affectedBookings,
    affectedHandling,
  });
}

function toExceptionView(e: StaffExceptionRecord): StaffCollectionException {
  return {
    id: e.id,
    kind: e.kind,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    opensLocal: e.opensLocal,
    closesLocal: e.closesLocal,
    source: e.source,
    reason: e.reasonInternal,
    saleTitle: e.saleTitle,
    canRemove: e.id !== null,
  };
}

export function toSettingsView(record: StaffSettingsRecord): StaffCollectionSettings {
  const { settings } = record;
  return {
    venueId: settings.venueId,
    version: settings.updatedAt.toISOString(),
    onlineBookingEnabled: settings.onlineBookingEnabled,
    bookingEmail: settings.bookingEmail,
    visitMinutes: settings.visitMinutes,
    placesPerSlot: settings.placesPerSlot,
    noticeCutoffLocal: settings.noticeCutoffLocal,
    noticeWorkingDays: settings.noticeWorkingDays,
    windowDays: settings.windowDays,
    closeOnSaleDays: settings.closeOnSaleDays,
    undoHandOverMinutes: settings.undoHandOverMinutes,
    freeStorageDays: settings.freeStorageDays,
    hours: record.hours.map((h) => ({ ...h })),
    exceptions: record.exceptions.map(toExceptionView),
    nextSaleDay: record.nextSaleDay
      ? { saleTitle: record.nextSaleDay.saleTitle, startsOn: record.nextSaleDay.startsOn }
      : null,
  };
}
