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
  DbTransaction,
  GuardSettingsTransaction,
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
import {
  type CollectionSettingsError,
  type CollectionSettingsResult,
  settingsError,
} from "./collection-settings.errors.js";

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
      maxActiveVisits: body.maxActiveVisits,
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

    const planned = await this.plan(
      venueId,
      configurationOf(current),
      configurationOf(current, {
        hours: body.hours,
        rules: { closeOnSaleDays: body.closeOnSaleDays, placesPerSlot: body.placesPerSlot },
      }),
      body.affectedBookings,
    );
    if (planned.isErr()) return err(planned.error);
    const plan = planned.value;
    const run: Run = { live: plan.live, cancelled: 0 };

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
        at: this.deps.now(),
      },
      async (tx, saved) => {
        run.cancelled = await this.enact(tx, actor, plan, run, "hours_changed");
        await this.record(
          tx,
          actor,
          COLLECTION_PLACE_EVENT_AGGREGATE,
          venueId,
          collectionPlaceUpdated({
            venueId,
            changed: saved.changed,
            affectedBookings: plan.newly.length,
            cancelledBookings: run.cancelled,
            affectedHandling: plan.handling,
          }),
        );
      },
      this.guard(venueId, plan, run),
    );
    if (outcome.outcome === "venue_not_found") return err(settingsError("venue_not_found"));
    if (outcome.outcome === "stale") return err(settingsError("settings_changed"));
    if (outcome.outcome === "affected_changed") return err(await this.shownAgain(venueId, plan));
    return ok(await this.result(venueId, plan, run));
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

    const planned = await this.plan(
      venueId,
      configurationOf(current),
      configurationOf(current, { extraException: { ...draft, source: "staff" } }),
      body.affectedBookings,
    );
    if (planned.isErr()) return err(planned.error);
    const plan = planned.value;
    const run: Run = { live: plan.live, cancelled: 0 };

    const outcome = await this.deps.settings.addException(
      { venueId, draft, reasonInternal: body.reason ?? null, createdByUserId: actor.userId },
      async (tx, added) => {
        run.cancelled = await this.enact(tx, actor, plan, run, "closure_added");
        await this.record(
          tx,
          actor,
          COLLECTION_PLACE_EVENT_AGGREGATE,
          venueId,
          exceptionEvent("collection.exception.added", venueId, added, plan, run.cancelled),
        );
      },
      this.guard(venueId, plan, run),
    );
    if (outcome.outcome === "venue_not_found") return err(settingsError("venue_not_found"));
    if (outcome.outcome === "affected_changed") return err(await this.shownAgain(venueId, plan));
    return ok(await this.result(venueId, plan, run));
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

    const planned = await this.plan(
      venueId,
      configurationOf(current),
      configurationOf(current, { without: exceptionId }),
      body.affectedBookings,
    );
    if (planned.isErr()) return err(planned.error);
    const plan = planned.value;
    const run: Run = { live: plan.live, cancelled: 0 };

    const outcome = await this.deps.settings.removeException(
      { venueId, exceptionId, at: this.deps.now() },
      async (tx, removed) => {
        run.cancelled = await this.enact(tx, actor, plan, run, "opening_removed");
        await this.record(
          tx,
          actor,
          COLLECTION_PLACE_EVENT_AGGREGATE,
          venueId,
          exceptionEvent("collection.exception.removed", venueId, removed, plan, run.cancelled),
        );
      },
      this.guard(venueId, plan, run),
    );
    if (outcome.outcome === "not_found") return err(settingsError("exception_not_found"));
    if (outcome.outcome === "affected_changed") return err(await this.shownAgain(venueId, plan));
    return ok(await this.result(venueId, plan, run));
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

  private async liveBookings(
    venueId: string,
    tx?: DbTransaction,
  ): Promise<CollectionBookingRecord[]> {
    const now = this.deps.now();
    const bookings = await this.deps.bookings.listInRange(
      venueId,
      { from: now, to: new Date(now.getTime() + HORIZON_DAYS * DAY_MS) },
      tx,
    );
    return bookings.filter((booking) => booking.status === "booked");
  }

  /**
   * What a change does to the bookings that are live now, checked against what staff were shown.
   * A change that touches none goes ahead whatever was sent. One that touches some needs a choice
   * that names every one of them: a booking that is affected but was not on the list staff saw
   * (made since) sends the list back instead.
   */
  private async plan(
    venueId: string,
    before: CollectionConfiguration,
    after: CollectionConfiguration,
    choice: AffectedBookingsChoice | undefined,
  ): Promise<CollectionSettingsResult<Plan>> {
    const live = await this.liveBookings(venueId);
    const newly = affectedBy(live, before, after);
    if (newly.length > 0) {
      const shown = new Set(choice?.bookingIds ?? []);
      if (!choice || newly.some((booking) => !shown.has(booking.bookingId))) {
        return err(settingsError("bookings_affected", { affected: affectedViews(newly, live) }));
      }
    }
    return ok({
      before,
      after,
      live,
      newly,
      handling: newly.length === 0 || !choice ? "none" : choice.choice,
    });
  }

  /**
   * Run inside the saving transaction, once the place is locked: the visits the change affects
   * must still be the ones staff chose about. A booking cannot be made while the lock is held, so
   * what is read here is what the change is applied to.
   */
  private guard(venueId: string, plan: Plan, run: Run): GuardSettingsTransaction {
    return async (tx) => {
      run.live = await this.liveBookings(venueId, tx);
      return sameBookings(affectedBy(run.live, plan.before, plan.after), plan.newly);
    };
  }

  /** The refusal for a change that went stale between the list and the save: the list as it is now. */
  private async shownAgain(venueId: string, plan: Plan): Promise<CollectionSettingsError> {
    const live = await this.liveBookings(venueId);
    const newly = affectedBy(live, plan.before, plan.after);
    return newly.length > 0
      ? settingsError("bookings_affected", { affected: affectedViews(newly, live) })
      : settingsError("settings_changed");
  }

  /**
   * Cancels, in the transaction of the change itself, the visits staff chose to cancel, and says
   * how many were cancelled. A visit that is no longer live is left as it is. Every visit in the
   * plan was shown to staff and is still affected: the guard has just checked.
   */
  private async enact(
    tx: DbTransaction,
    actor: CollectionSettingsActor,
    plan: Plan,
    run: Run,
    why: Why,
  ): Promise<number> {
    if (plan.handling !== "cancel_and_rebook") return 0;
    let cancelled = 0;
    for (const item of plan.newly) {
      const booking = run.live.find((b) => b.id === item.bookingId);
      if (!booking) continue;
      const outcome = await this.deps.bookings.cancel(
        {
          bookingId: booking.id,
          expectedSequence: booking.icsSequence,
          cancelledByUserId: actor.userId,
          at: this.deps.now(),
        },
        (inner, done) =>
          this.record(
            inner,
            actor,
            COLLECTION_BOOKING_EVENT_AGGREGATE,
            done.id,
            collectionBookingCancelled(done, "staff", why),
          ),
        tx,
      );
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
    plan: Plan,
    run: Run,
  ): Promise<StaffCollectionChangeResult> {
    const fresh = await this.read(venueId);
    if (!fresh) throw new Error(`Collection place ${venueId} disappeared after a change`);
    return {
      settings: toSettingsView(fresh),
      affected: affectedViews(plan.newly, run.live),
      cancelled: run.cancelled,
    };
  }
}

/** What a change would do to the live visits, and what staff chose to do about them. */
type Plan = {
  before: CollectionConfiguration;
  after: CollectionConfiguration;
  live: CollectionBookingRecord[];
  newly: AffectedBooking[];
  handling: AffectedHandling;
};

/** The live visits as the saving transaction read them, and how many it cancelled. */
type Run = { live: CollectionBookingRecord[]; cancelled: number };

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

/** The bookings a change newly puts outside the offer, for the live visits given. */
function affectedBy(
  live: readonly CollectionBookingRecord[],
  before: CollectionConfiguration,
  after: CollectionConfiguration,
): AffectedBooking[] {
  const visits = live.map(liveOf);
  return newlyAffected(bookingsAffectedBy(visits, before), bookingsAffectedBy(visits, after));
}

const sameBookings = (a: readonly AffectedBooking[], b: readonly AffectedBooking[]): boolean =>
  a.length === b.length && a.every((item) => b.some((other) => other.bookingId === item.bookingId));

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
  plan: Plan,
  cancelledBookings: number,
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
    affectedBookings: plan.newly.length,
    cancelledBookings,
    affectedHandling: plan.handling,
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
    maxActiveVisits: settings.maxActiveVisits,
    freeStorageDays: settings.freeStorageDays,
    hours: record.hours.map((h) => ({ ...h })),
    exceptions: record.exceptions.map(toExceptionView),
    nextSaleDay: record.nextSaleDay
      ? { saleTitle: record.nextSaleDay.saleTitle, startsOn: record.nextSaleDay.startsOn }
      : null,
  };
}
