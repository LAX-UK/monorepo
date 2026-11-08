import {
  COLLECTION_AUTHORISATION_POLICY_VERSION,
  COLLECTION_BOOKING_EVENT_AGGREGATE,
  type CollectionBookingEvent,
  type CollectionCalendar,
  type CollectionDay,
  type CollectionRules,
  type DateKey,
  type TransitionContext,
  accountPurchaseScope,
  addDaysToKey,
  allowedBookingActions,
  buildCollectionIcs,
  collectionBookingCancelled,
  collectionBookingChanged,
  collectionBookingCreated,
  collectionCalendarFilename,
  collectionSlots,
  createCollectionCalendar,
  earliestOpenSlot,
  londonDateKey,
  noticeDeadline,
  resolveCollector,
  slotRefusal,
  transitionBooking,
} from "@auction/domain";
import type {
  CollectionBookingRecord,
  CollectionCollectorInput,
  CollectionPlaceSettings,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionLotFactsReader,
  ICollectionPlaceRepository,
  NewCollectionBooking,
} from "@auction/persistence/interfaces";
import type {
  CollectionAvailability,
  CollectionVisitAction,
  CollectionVisitView,
} from "@auction/types";
import type {
  BookCollectionBody,
  CancelCollectionBody,
  ChangeCollectionBody,
} from "@auction/validators";
import { err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  BookedVisit,
  CalendarFile,
  ICollectionVisitService,
} from "../interfaces/collection-visit-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { CollectionLotGuard } from "./collection-lot-guard.js";
import { type CollectionVisitResult, visitError } from "./collection-visit.errors.js";
import { toDayView, toVisitView } from "./collection-visit.view.js";

const DAY_MS = 24 * 60 * 60_000;
/** How far back the working days before a visit are looked up, as the notice rule counts them. */
const NOTICE_LOOKBACK_DAYS = 61;
const LIST_LIMIT = 200;
/** What staff and the page call the person who answers a collection question. */
const CLIENT_ACTIONS: readonly CollectionVisitAction[] = ["change", "cancel"];

export type CollectionVisitDeps = {
  lots: CollectionLotGuard;
  facts: Pick<ICollectionLotFactsReader, "read">;
  places: Pick<ICollectionPlaceRepository, "find" | "ensure" | "readCalendarFacts" | "findAddress">;
  bookings: ICollectionBookingReader & ICollectionBookingWriter;
  events: IDomainEventSink;
  now: () => Date;
};

type PlaceSnapshot = {
  settings: CollectionPlaceSettings;
  days: CollectionDay[];
  calendar: CollectionCalendar;
};

export class CollectionVisitService implements ICollectionVisitService {
  constructor(private readonly deps: CollectionVisitDeps) {}

  // ---- reading ------------------------------------------------------------------------------

  async availability(
    actor: OrganisationMemberActor,
    query: { lots: readonly string[]; booking?: string | undefined },
  ): Promise<CollectionVisitResult<CollectionAvailability>> {
    let ownBooking: CollectionBookingRecord | null = null;
    if (query.booking) {
      const own = await this.ownBooking(actor, query.booking);
      if (own.isErr()) return err(own.error);
      ownBooking = own.value;
    }

    const resolved = await this.deps.lots.resolve(actor, query.lots, {
      ownBookingId: ownBooking?.id ?? null,
      requireCollectable: false,
      write: false,
    });
    if (resolved.isErr()) return err(resolved.error);
    const { venueId, lines } = resolved.value;

    const settings = await this.deps.places.find(venueId);
    if (!settings) return err(visitError("online_booking_off", { bookingEmail: null }));
    const base = {
      venueId,
      onlineBookingEnabled: settings.onlineBookingEnabled,
      bookingEmail: settings.bookingEmail,
      visitMinutes: settings.visitMinutes,
      windowDays: settings.windowDays,
      noticeCutoffLocal: settings.noticeCutoffLocal,
      timeZone: "Europe/London" as const,
      lots: lines,
    };
    if (!settings.onlineBookingEnabled) {
      return ok({ ...base, earliest: null, days: [] });
    }

    const snapshot = await this.snapshot(venueId, settings, ownBooking);
    const open = earliestOpenSlot(snapshot.days);
    return ok({
      ...base,
      earliest: open ? open.start.toISOString() : null,
      days: snapshot.days.map(toDayView),
    });
  }

  async list(
    actor: OrganisationMemberActor,
  ): Promise<CollectionVisitResult<CollectionVisitView[]>> {
    const scope = accountPurchaseScope({ role: actor.role });
    if (!scope) return err(visitError("insufficient_entity_role"));

    const bookings = await this.deps.bookings.listForAccount(actor.legalEntityId, LIST_LIMIT);
    const lotIds = [...new Set(bookings.flatMap((b) => b.lots.map((lot) => lot.lotId)))];
    const facts = await this.deps.facts.read(lotIds);

    // A buyer agent sees the visits they made, and those that hold only lots they won.
    const visible =
      scope === "all"
        ? bookings
        : bookings.filter(
            (booking) =>
              booking.bookedByUserId === actor.userId ||
              (booking.lots.length > 0 &&
                booking.lots.every((lot) => facts.get(lot.lotId)?.winnerId === actor.userId)),
          );

    const now = this.deps.now();
    const calendars = new Map<string, Promise<PlaceSnapshot | null>>();
    const calendarOf = (venueId: string, farthest: Date) => {
      let loaded = calendars.get(venueId);
      if (!loaded) {
        loaded = this.calendarSnapshot(venueId, farthest);
        calendars.set(venueId, loaded);
      }
      return loaded;
    };
    const farthest = new Date(
      Math.max(now.getTime(), ...visible.map((booking) => booking.slotStart.getTime())),
    );

    const views: CollectionVisitView[] = [];
    for (const booking of visible) {
      const live = booking.status === "booked" && booking.slotStart.getTime() > now.getTime();
      const snapshot = live ? await calendarOf(booking.venueId, farthest) : null;
      views.push(
        toVisitView(booking, {
          actorUserId: actor.userId,
          titles: titlesOf(facts),
          noticeDeadline: snapshot
            ? noticeDeadline(booking.slotStart, snapshot.settings, snapshot.calendar)
            : null,
          actions:
            snapshot && !actor.isImpersonation ? this.clientActions(booking, snapshot, now) : [],
        }),
      );
    }
    return ok(views);
  }

  async calendar(
    actor: OrganisationMemberActor,
    bookingId: string,
  ): Promise<CollectionVisitResult<CalendarFile>> {
    const found = await this.ownBooking(actor, bookingId);
    if (found.isErr()) return err(found.error);
    const booking = found.value;
    if (booking.status !== "booked") return err(visitError("booking_closed"));

    const authority = await this.deps.lots.resolve(actor, activeLotIds(booking), {
      ownBookingId: booking.id,
      requireCollectable: false,
      write: false,
    });
    if (authority.isErr()) return err(authority.error);
    const place = await this.deps.places.findAddress(booking.venueId);
    const titles = titlesOf(await this.deps.facts.read(activeLotIds(booking)));
    const lines = [
      ...booking.lots
        .filter((lot) => lot.active)
        .map((lot) => titles.get(lot.lotId)?.title ?? "Lot"),
      `Collecting: ${booking.collector.name}`,
      "Bring photo ID in that name: a passport, driving licence or national identity card.",
      `Reference ${booking.reference}`,
    ];
    return ok({
      filename: collectionCalendarFilename(booking.reference),
      content: buildCollectionIcs({
        method: "PUBLISH",
        reference: booking.reference,
        sequence: booking.icsSequence,
        start: booking.slotStart,
        end: booking.slotEnd,
        stamp: this.deps.now(),
        summary: place ? `Collection at ${place.name}` : "Collection",
        location: place?.address ?? "",
        description: lines,
      }),
    });
  }

  // ---- booking ------------------------------------------------------------------------------

  async book(
    actor: OrganisationMemberActor,
    body: BookCollectionBody,
  ): Promise<CollectionVisitResult<BookedVisit>> {
    if (actor.isImpersonation) return err(visitError("read_only"));
    // Whose lots these are is settled first. Whether each can be collected now is not: a repeat of
    // an attempt that already succeeded must get its booking back, and by then its lots are booked.
    const resolved = await this.deps.lots.resolve(actor, body.lotIds, {
      requireCollectable: false,
      write: true,
    });
    if (resolved.isErr()) return err(resolved.error);
    const { venueId, lines } = resolved.value;

    const settings = await this.deps.places.find(venueId);
    const collector = this.collectorOf(actor, body.collector);
    if (collector.isErr()) return err(collector.error);
    const slotStart = new Date(body.slotStart);
    const request = (slotEnd: Date): NewCollectionBooking => ({
      legalEntityId: actor.legalEntityId,
      venueId,
      slotStart,
      slotEnd,
      placesPerSlot: settings?.placesPerSlot ?? 1,
      overCapacityReason: null,
      lotIds: body.lotIds,
      collector: collector.value,
      bookedByUserId: actor.userId,
      bookedVia: "client",
      idempotencyKey: body.idempotencyKey,
    });

    if (
      settings &&
      (await this.deps.bookings.hasIdempotencyKey(actor.legalEntityId, body.idempotencyKey))
    ) {
      // The key was used before: the answer is the first booking, or a refusal if this is another request.
      const visitMs = settings.visitMinutes * 60_000;
      const prior = await this.deps.bookings.book(request(new Date(slotStart.getTime() + visitMs)));
      if (prior.outcome === "replayed") {
        const snapshot = await this.snapshot(venueId, settings, null);
        return ok({ visit: await this.viewOf(actor, prior.booking, snapshot), replayed: true });
      }
      return err(visitError("idempotency_key_reused"));
    }

    if (!settings?.onlineBookingEnabled) {
      return err(
        visitError("online_booking_off", { bookingEmail: settings?.bookingEmail ?? null }),
      );
    }
    const blocked = lines.find((line) => !line.collectable);
    if (blocked) {
      return err(
        visitError("lot_not_collectable", {
          lotId: blocked.lotId,
          ...(blocked.blockedReason ? { reason: blocked.blockedReason } : {}),
        }),
      );
    }

    const snapshot = await this.snapshot(venueId, settings, null);
    const refusal = slotRefusal(snapshot.days, slotStart);
    if (refusal === "unknown_slot") return err(visitError("slot_unknown"));
    if (refusal === "notice_passed") return err(visitError("notice_passed"));
    if (refusal === "slot_full") return err(visitError("slot_full"));
    const slot = findSlot(snapshot.days, slotStart);
    if (!slot) return err(visitError("slot_unknown"));

    const outcome = await this.deps.bookings.book(request(slot.end), (tx, booking) =>
      this.record(tx, actor, collectionBookingCreated(booking)),
    );

    switch (outcome.outcome) {
      case "booked":
        return ok({ visit: await this.viewOf(actor, outcome.booking, snapshot), replayed: false });
      case "replayed":
        return ok({ visit: await this.viewOf(actor, outcome.booking, snapshot), replayed: true });
      case "slot_full":
        return err(visitError("slot_full"));
      case "key_reused":
        return err(visitError("idempotency_key_reused"));
      case "lot_taken":
        return err(
          visitError("lot_not_collectable", {
            ...(outcome.lotIds[0] ? { lotId: outcome.lotIds[0] } : {}),
            reason: "already_booked",
          }),
        );
    }
  }

  async change(
    actor: OrganisationMemberActor,
    bookingId: string,
    body: ChangeCollectionBody,
  ): Promise<CollectionVisitResult<CollectionVisitView>> {
    if (actor.isImpersonation) return err(visitError("read_only"));
    const found = await this.ownBooking(actor, bookingId);
    if (found.isErr()) return err(found.error);
    const booking = found.value;

    const settings = await this.deps.places.find(booking.venueId);
    if (!settings) return err(visitError("unavailable"));
    const snapshot = await this.snapshot(booking.venueId, settings, booking);
    const allowed = this.transition("change", booking, snapshot);
    if (allowed) return err(allowed);

    // The person may change a visit only if they could book every lot it will hold, and those
    // lots must each still be collectable (the lots it already holds do not count as booked).
    const current = await this.deps.lots.resolve(actor, activeLotIds(booking), {
      ownBookingId: booking.id,
      requireCollectable: false,
      write: true,
    });
    if (current.isErr()) return err(current.error);
    const wanted = await this.deps.lots.resolve(actor, body.lotIds, {
      ownBookingId: booking.id,
      requireCollectable: true,
      write: true,
    });
    if (wanted.isErr()) return err(wanted.error);
    if (wanted.value.venueId !== booking.venueId) return err(visitError("mixed_places"));

    const collector = this.collectorOf(actor, body.collector);
    if (collector.isErr()) return err(collector.error);

    const slotStart = new Date(body.slotStart);
    let slotEnd = booking.slotEnd;
    if (slotStart.getTime() !== booking.slotStart.getTime()) {
      const refusal = slotRefusal(snapshot.days, slotStart);
      if (refusal === "unknown_slot") return err(visitError("slot_unknown"));
      if (refusal === "notice_passed") return err(visitError("notice_passed"));
      if (refusal === "slot_full") return err(visitError("slot_full"));
      const slot = findSlot(snapshot.days, slotStart);
      if (!slot) return err(visitError("slot_unknown"));
      slotEnd = slot.end;
    }

    const outcome = await this.deps.bookings.change(
      {
        bookingId: booking.id,
        expectedSequence: body.version,
        slotStart,
        slotEnd,
        placesPerSlot: snapshot.settings.placesPerSlot,
        overCapacityReason: null,
        lotIds: body.lotIds,
        collector: collector.value,
      },
      (tx, changed) => this.record(tx, actor, collectionBookingChanged(changed, booking.slotStart)),
    );
    switch (outcome.outcome) {
      case "changed":
        return ok(await this.viewOf(actor, outcome.booking, snapshot));
      case "not_found":
        return err(visitError("booking_not_found"));
      case "stale":
        return err(visitError("booking_changed"));
      case "slot_full":
        return err(visitError("slot_full"));
      case "lot_taken":
        return err(
          visitError("lot_not_collectable", {
            ...(outcome.lotIds[0] ? { lotId: outcome.lotIds[0] } : {}),
            reason: "already_booked",
          }),
        );
    }
  }

  async cancel(
    actor: OrganisationMemberActor,
    bookingId: string,
    body: CancelCollectionBody,
  ): Promise<CollectionVisitResult<CollectionVisitView>> {
    if (actor.isImpersonation) return err(visitError("read_only"));
    const found = await this.ownBooking(actor, bookingId);
    if (found.isErr()) return err(found.error);
    const booking = found.value;

    const settings = await this.deps.places.find(booking.venueId);
    if (!settings) return err(visitError("unavailable"));
    const snapshot = await this.snapshot(booking.venueId, settings, booking);
    const refusal = this.transition("cancel", booking, snapshot);
    if (refusal) return err(refusal);

    const authority = await this.deps.lots.resolve(actor, activeLotIds(booking), {
      ownBookingId: booking.id,
      requireCollectable: false,
      write: true,
    });
    if (authority.isErr()) return err(authority.error);

    const outcome = await this.deps.bookings.cancel(
      {
        bookingId: booking.id,
        expectedSequence: body.version,
        cancelledByUserId: actor.userId,
        at: this.deps.now(),
      },
      (tx, cancelled) => this.record(tx, actor, collectionBookingCancelled(cancelled, "client")),
    );
    switch (outcome.outcome) {
      case "cancelled":
        return ok(await this.viewOf(actor, outcome.booking, snapshot));
      case "not_found":
        return err(visitError("booking_not_found"));
      case "stale":
        return err(visitError("booking_changed"));
    }
  }

  // ---- internals ----------------------------------------------------------------------------

  /** The booking if it is the acting account's; anyone else's reads as not found. */
  private async ownBooking(
    actor: OrganisationMemberActor,
    bookingId: string,
  ): Promise<CollectionVisitResult<CollectionBookingRecord>> {
    const booking = await this.deps.bookings.findById(bookingId);
    if (!booking || booking.legalEntityId !== actor.legalEntityId) {
      return err(visitError("booking_not_found"));
    }
    return ok(booking);
  }

  /** The state and cut-off rules for a client's action; the refusal, or `null` when it is allowed. */
  private transition(
    action: "change" | "cancel",
    booking: CollectionBookingRecord,
    snapshot: PlaceSnapshot,
  ) {
    const result = transitionBooking(
      action,
      this.transitionContext(booking, snapshot, this.deps.now()),
    );
    if (result.ok) return null;
    if (result.reason === "cutoff_passed") return visitError("cutoff_passed");
    return visitError("booking_closed");
  }

  private transitionContext(
    booking: CollectionBookingRecord,
    snapshot: PlaceSnapshot,
    now: Date,
  ): TransitionContext {
    return {
      status: booking.status,
      actor: "client",
      now,
      slotStart: booking.slotStart,
      handedOverAt: booking.outcomeAt,
      rules: snapshot.settings,
      calendar: snapshot.calendar,
    };
  }

  private clientActions(
    booking: CollectionBookingRecord,
    snapshot: PlaceSnapshot,
    now: Date,
  ): CollectionVisitAction[] {
    return allowedBookingActions(this.transitionContext(booking, snapshot, now)).filter(
      (action): action is CollectionVisitAction =>
        (CLIENT_ACTIONS as readonly string[]).includes(action),
    );
  }

  /** Who collects, as stored: the booker for "self", and the authorisation for a third party. */
  private collectorOf(
    actor: OrganisationMemberActor,
    input: BookCollectionBody["collector"],
  ): CollectionVisitResult<CollectionCollectorInput> {
    const resolved = resolveCollector(input);
    if (!resolved.ok) return err(visitError("collector_invalid", { issues: resolved.issues }));
    const { collector } = resolved;
    const thirdParty = collector.kind === "third_party";
    const now = this.deps.now();
    return ok({
      kind: collector.kind,
      name: collector.name,
      email: collector.email,
      company: collector.company,
      userId: collector.kind === "self" ? actor.userId : null,
      authorisedByUserId: thirdParty ? actor.userId : null,
      authorisedAt: thirdParty ? now : null,
      policyVersion: thirdParty ? COLLECTION_AUTHORISATION_POLICY_VERSION : null,
    });
  }

  private async record(
    tx: Parameters<IDomainEventSink["withTx"]>[0],
    actor: OrganisationMemberActor,
    event: CollectionBookingEvent,
  ): Promise<void> {
    await this.deps.events.withTx(tx).publish({
      aggregateType: COLLECTION_BOOKING_EVENT_AGGREGATE,
      aggregateId: event.payload.bookingId,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: actor.userId,
      actingLegalEntityId: actor.legalEntityId,
    });
  }

  /**
   * The place's rules and the days it offers now, with places already taken counted. The booking
   * being moved (if any) does not count against its own slot, so it can be chosen again.
   */
  private async snapshot(
    venueId: string,
    settings: CollectionPlaceSettings,
    moving: CollectionBookingRecord | null,
  ): Promise<PlaceSnapshot> {
    const now = this.deps.now();
    const today = londonDateKey(now);
    const lastDay = latest(
      addDaysToKey(today, settings.windowDays),
      moving ? londonDateKey(moving.slotStart) : today,
    );
    const calendarFacts = await this.deps.places.readCalendarFacts(venueId, {
      from: addDaysToKey(today, -NOTICE_LOOKBACK_DAYS),
      to: lastDay,
    });
    const taken = await this.deps.bookings.takenPlaces(venueId, {
      from: new Date(now.getTime() - 36 * 60 * 60_000),
      to: new Date(now.getTime() + (settings.windowDays + 2) * DAY_MS),
    });
    if (moving?.status === "booked") {
      const key = moving.slotStart.getTime();
      const count = taken.get(key) ?? 0;
      if (count > 0) taken.set(key, count - 1);
    }
    const rules: CollectionRules = calendarFacts.settings;
    return {
      settings: calendarFacts.settings,
      days: collectionSlots({
        hours: calendarFacts.hours,
        exceptions: calendarFacts.exceptions,
        rules,
        now,
        takenPlaces: taken,
      }),
      calendar: createCollectionCalendar({
        hours: calendarFacts.hours,
        exceptions: calendarFacts.exceptions,
        rules,
      }),
    };
  }

  /** Just the calendar, for working out cut-offs of visits that may be well ahead. */
  private async calendarSnapshot(venueId: string, farthest: Date): Promise<PlaceSnapshot | null> {
    const settings = await this.deps.places.find(venueId);
    if (!settings) return null;
    const today = londonDateKey(this.deps.now());
    const facts = await this.deps.places.readCalendarFacts(venueId, {
      from: addDaysToKey(today, -NOTICE_LOOKBACK_DAYS),
      to: latest(addDaysToKey(today, settings.windowDays), londonDateKey(farthest)),
    });
    return {
      settings: facts.settings,
      days: [],
      calendar: createCollectionCalendar({
        hours: facts.hours,
        exceptions: facts.exceptions,
        rules: facts.settings,
      }),
    };
  }

  private async viewOf(
    actor: OrganisationMemberActor,
    booking: CollectionBookingRecord,
    snapshot: PlaceSnapshot,
  ): Promise<CollectionVisitView> {
    const now = this.deps.now();
    const live = booking.status === "booked";
    return toVisitView(booking, {
      actorUserId: actor.userId,
      titles: titlesOf(await this.deps.facts.read(booking.lots.map((lot) => lot.lotId))),
      noticeDeadline: live
        ? noticeDeadline(booking.slotStart, snapshot.settings, snapshot.calendar)
        : null,
      actions: live && !actor.isImpersonation ? this.clientActions(booking, snapshot, now) : [],
    });
  }
}

function activeLotIds(booking: CollectionBookingRecord): string[] {
  return booking.lots.filter((lot) => lot.active).map((lot) => lot.lotId);
}

function titlesOf(
  facts: ReadonlyMap<string, { title: string; lotNumber: number | null }>,
): Map<string, { title: string; lotNumber: number | null }> {
  return new Map(
    [...facts].map(([lotId, record]) => [
      lotId,
      { title: record.title, lotNumber: record.lotNumber },
    ]),
  );
}

function findSlot(days: readonly CollectionDay[], start: Date) {
  for (const day of days) {
    const slot = day.slots.find((s) => s.start.getTime() === start.getTime());
    if (slot) return slot;
  }
  return null;
}

function latest(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}
