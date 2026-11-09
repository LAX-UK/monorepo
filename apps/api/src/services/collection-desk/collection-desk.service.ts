import {
  COLLECTION_AUTHORISATION_POLICY_VERSION,
  COLLECTION_BOOKING_EVENT_AGGREGATE,
  type CollectionBookingEvent,
  type CollectionIdType,
  type CollectionRules,
  type TransitionContext,
  addDaysToKey,
  allowedBookingActions,
  collectionBlockMessage,
  collectionBookingChanged,
  collectionBookingCreated,
  collectionBookingHandOverUndone,
  collectionBookingHandedOver,
  collectionBookingNotCollected,
  collectionEligibility,
  collectionSlots,
  createCollectionCalendar,
  handOverRefusal,
  isDateKey,
  londonDateKey,
  lotSelectionRefusal,
  noticeDeadline,
  resolveCollector,
  transitionBooking,
} from "@auction/domain";
import type {
  CollectionBookingRecord,
  CollectionCollectorInput,
  CollectionPlaceSettings,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionDeskReader,
  ICollectionLotFactsReader,
  ICollectionOutcomeWriter,
  ICollectionPlaceRepository,
} from "@auction/persistence/interfaces";
import type {
  DeskAction,
  DeskBookingView,
  DeskClientLot,
  DeskDayView,
  DeskFulfilmentStatus,
  DeskGroupView,
  DeskListView,
  DeskLotView,
} from "@auction/types";
import type {
  CollectionDeskBookForClientBody,
  CollectionDeskHandOverBody,
  CollectionDeskRebookBody,
} from "@auction/validators";
import { err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { DeskStaff, ICollectionDeskService } from "../interfaces/collection-desk-service.js";
import type { ILotFulfilmentAdminService } from "../interfaces/lot-fulfilment-service.js";
import { type CollectionDeskResult, deskError } from "./collection-desk.errors.js";

const DAY_MS = 24 * 60 * 60_000;
const NOTICE_LOOKBACK_DAYS = 61;
const LIST_LIMIT = 200;
/** Fulfilment statuses from which staff have released the work, so it can be handed over. */
const RELEASED: readonly string[] = ["released", "ready_for_collection"];
const MAX_LOTS = 20;

export type CollectionDeskDeps = {
  places: Pick<ICollectionPlaceRepository, "find" | "readCalendarFacts">;
  bookings: ICollectionBookingReader & ICollectionBookingWriter & ICollectionOutcomeWriter;
  desk: ICollectionDeskReader;
  facts: Pick<ICollectionLotFactsReader, "read" | "lotIdsForBuyer">;
  fulfilment: Pick<ILotFulfilmentAdminService, "handOverForCollection" | "undoCollectionHandOver">;
  events: IDomainEventSink;
  now: () => Date;
};

type PlaceFacts = Awaited<ReturnType<CollectionDeskDeps["places"]["readCalendarFacts"]>>;

export class CollectionDeskService implements ICollectionDeskService {
  constructor(private readonly deps: CollectionDeskDeps) {}

  // ---- reading ------------------------------------------------------------------------------

  async day(venueId: string, date: string): Promise<CollectionDeskResult<DeskDayView>> {
    if (!isDateKey(date)) return err(deskError("invalid_date"));
    const settings = await this.deps.places.find(venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.placeFacts(venueId, date);
    const calendar = createCollectionCalendar({
      hours: facts.hours,
      exceptions: facts.exceptions,
      rules: facts.settings,
    });
    const plan = calendar.plan(date);

    // The times the day offers, whatever the notice: staff see the day as it is, not as a buyer does.
    const offered = collectionSlots({
      hours: facts.hours,
      exceptions: facts.exceptions,
      rules: { ...facts.settings, windowDays: 1 },
      now: new Date(`${date}T12:00:00.000Z`),
    })[0];
    const bookings = (
      await this.deps.bookings.listInRange(venueId, {
        from: new Date(new Date(`${date}T12:00:00.000Z`).getTime() - DAY_MS),
        to: new Date(new Date(`${date}T12:00:00.000Z`).getTime() + DAY_MS),
      })
    ).filter((booking) => londonDateKey(booking.slotStart) === date);

    const views = await this.views(bookings, facts.settings, facts, now);
    const capacity = facts.settings.placesPerSlot;
    const starts = new Map<number, { start: Date; end: Date }>();
    for (const slot of offered?.slots ?? []) starts.set(slot.start.getTime(), slot);
    for (const booking of bookings)
      starts.set(booking.slotStart.getTime(), { start: booking.slotStart, end: booking.slotEnd });
    const groups: DeskGroupView[] = [...starts.values()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((slot) => {
        const inSlot = views.filter(
          (view) => new Date(view.start).getTime() === slot.start.getTime(),
        );
        return {
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          taken: inSlot.filter((view) => TAKES_A_PLACE.includes(view.status)).length,
          capacity,
          bookings: inSlot,
        };
      });
    const open = groups.filter((group) => group.bookings.length === 0).length;
    return ok({
      venueId,
      date,
      state: plan.kind === "closed" ? (plan.reason === "sale_day" ? "sale_day" : "closed") : "open",
      canOpenAnyway: plan.kind === "closed" && plan.reason === "sale_day",
      capacity,
      visitMinutes: facts.settings.visitMinutes,
      openTimes: open,
      groups,
      toHandOver: views.filter((view) => view.status === "booked").length,
      notCollected: (await this.missed(venueId, facts.settings, facts, now)).length,
    });
  }

  async list(
    venueId: string,
    status: "upcoming" | "not_collected",
  ): Promise<CollectionDeskResult<DeskListView>> {
    const settings = await this.deps.places.find(venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.placeFacts(venueId, londonDateKey(now));
    if (status === "not_collected") {
      return ok({ venueId, status, items: await this.missed(venueId, facts.settings, facts, now) });
    }
    const upcoming = (
      await this.deps.bookings.listInRange(venueId, {
        from: now,
        to: new Date(now.getTime() + (facts.settings.windowDays + 2) * DAY_MS),
      })
    ).filter((booking) => booking.status === "booked");
    return ok({ venueId, status, items: await this.views(upcoming, facts.settings, facts, now) });
  }

  async clientLots(
    venueId: string,
    legalEntityId: string,
  ): Promise<CollectionDeskResult<DeskClientLot[]>> {
    if (!(await this.deps.places.find(venueId))) return err(deskError("place_not_set_up"));
    const ids = await this.deps.facts.lotIdsForBuyer(legalEntityId, venueId, 100);
    const found = await this.deps.facts.read(ids);
    const lines: DeskClientLot[] = [];
    for (const lotId of ids) {
      const record = found.get(lotId);
      if (!record) continue;
      const decision = collectionEligibility(record.facts);
      lines.push({
        lotId,
        title: record.title,
        lotNumber: record.lotNumber,
        collectable: decision.eligible,
        blockedMessage: decision.eligible ? null : collectionBlockMessage(decision.reason),
      });
    }
    return ok(lines);
  }

  // ---- the desk -----------------------------------------------------------------------------

  async handOver(
    staff: DeskStaff,
    bookingId: string,
    body: CollectionDeskHandOverBody,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    const booking = await this.deps.bookings.findById(bookingId);
    if (!booking) return err(deskError("booking_not_found"));
    const settings = await this.deps.places.find(booking.venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.placeFacts(booking.venueId, londonDateKey(booking.slotStart));

    if (booking.status !== "booked") return err(deskError("booking_closed"));
    const live = booking.lots.filter((lot) => lot.active).map((lot) => lot.lotId);
    const ticked = [...new Set(body.lotIds)];
    const strangers = ticked.filter((id) => !live.includes(id));
    if (strangers.length > 0) return err(deskError("lot_not_in_booking", { lotIds: strangers }));
    const action = ticked.length === live.length ? "hand_over_all" : "hand_over_some";
    const moved = transitionBooking(action, this.context(booking, facts, now));
    if (!moved.ok)
      return err(
        deskError(moved.reason === "cutoff_passed" ? "booking_closed" : (moved.reason as never)),
      );

    // Release first: the lots must be released, and the ID checked.
    const desk = await this.deps.desk.lots(ticked);
    const lots = ticked.map((lotId) => ({
      lotId,
      released: RELEASED.includes(desk.get(lotId)?.fulfilmentStatus ?? ""),
    }));
    const refusal = handOverRefusal({ lots, idChecked: body.idCheck.confirmed });
    if (refusal === "not_released") {
      return err(
        deskError("not_released", {
          lotIds: lots.filter((lot) => !lot.released).map((l) => l.lotId),
        }),
      );
    }
    if (refusal === "no_lots") return err(deskError("no_lots"));

    // A hold can open after the booking was made: look again at the moment of hand-over.
    const held = await this.holdOn(ticked);
    if (held) return err(held);

    const outcome = await this.deps.bookings.recordHandOver(
      {
        bookingId,
        handedOverLotIds: ticked,
        idCheckType: body.idCheck.type as CollectionIdType,
        staffUserId: staff.userId,
        at: now,
      },
      (tx, handed) =>
        this.record(
          tx,
          staff,
          collectionBookingHandedOver(handed, {
            handedOverLotIds: ticked,
            leftLotIds: handed.lots.filter((l) => l.outcome === "left").map((l) => l.lotId),
            idCheckType: body.idCheck.type as CollectionIdType,
            status: handed.status === "collected" ? "collected" : "partly_collected",
          }),
        ),
    );
    switch (outcome.outcome) {
      case "not_found":
        return err(deskError("booking_not_found"));
      case "stale":
        return err(deskError("booking_changed"));
      case "lot_not_in_booking":
        return err(deskError("lot_not_in_booking", { lotIds: outcome.lotIds }));
      case "handed_over":
        break;
    }

    // The works leave the store: each lot's fulfilment closes with who collected and who handed it over.
    const done: string[] = [];
    for (const lotId of ticked) {
      const moved = await this.deps.fulfilment.handOverForCollection({
        lotId,
        actorUserId: staff.userId,
        collectedBy: booking.collector.name,
      });
      if (moved.isErr()) {
        await this.rollBackHandOver(staff, bookingId, done, now);
        return err(deskError("fulfilment_failed", { lotId }));
      }
      done.push(lotId);
    }
    return ok(await this.viewOne(outcome.booking, facts.settings, facts, now));
  }

  async undoHandOver(
    staff: DeskStaff,
    bookingId: string,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    const booking = await this.deps.bookings.findById(bookingId);
    if (!booking) return err(deskError("booking_not_found"));
    const settings = await this.deps.places.find(booking.venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.placeFacts(booking.venueId, londonDateKey(booking.slotStart));
    const moved = transitionBooking("undo_hand_over", {
      ...this.context(booking, facts, now),
      handedOverAt: booking.outcomeAt,
    });
    if (!moved.ok) return err(deskError(moved.reason as never));

    const handedLots = booking.lots
      .filter((lot) => lot.outcome === "collected")
      .map((l) => l.lotId);
    const outcome = await this.deps.bookings.undoHandOver({ bookingId, at: now }, (tx, undone) =>
      this.record(tx, staff, collectionBookingHandOverUndone(undone)),
    );
    switch (outcome.outcome) {
      case "not_found":
        return err(deskError("booking_not_found"));
      case "stale":
        return err(deskError("booking_changed"));
      case "lot_taken":
        return err(
          deskError("lot_not_collectable", {
            lotId: outcome.lotIds[0] as string,
            reason: "already_booked",
          }),
        );
      case "undone":
        break;
    }
    for (const lotId of handedLots) {
      await this.deps.fulfilment.undoCollectionHandOver({ lotId });
    }
    return ok(await this.viewOne(outcome.booking, facts.settings, facts, now));
  }

  async markNotCollected(
    staff: DeskStaff,
    bookingId: string,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    const booking = await this.deps.bookings.findById(bookingId);
    if (!booking) return err(deskError("booking_not_found"));
    const settings = await this.deps.places.find(booking.venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.placeFacts(booking.venueId, londonDateKey(booking.slotStart));
    const moved = transitionBooking("mark_not_collected", this.context(booking, facts, now));
    if (!moved.ok) return err(deskError(moved.reason as never));
    const outcome = await this.deps.bookings.markNotCollected(
      { bookingId, staffUserId: staff.userId, at: now },
      (tx, marked) => this.record(tx, staff, collectionBookingNotCollected(marked)),
    );
    if (outcome.outcome === "not_found") return err(deskError("booking_not_found"));
    if (outcome.outcome === "stale") return err(deskError("booking_changed"));
    return ok(await this.viewOne(outcome.booking, facts.settings, facts, now));
  }

  async rebook(
    staff: DeskStaff,
    bookingId: string,
    body: CollectionDeskRebookBody,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    const booking = await this.deps.bookings.findById(bookingId);
    if (!booking) return err(deskError("booking_not_found"));
    const settings = await this.deps.places.find(booking.venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const slotStart = new Date(body.slotStart);
    const facts = await this.placeFacts(booking.venueId, londonDateKey(slotStart));
    const chosen = await this.chooseSlot(
      booking.venueId,
      facts,
      slotStart,
      booking,
      now,
      body.override?.reason,
    );
    if (chosen.isErr()) return err(chosen.error);
    const { slotEnd, reason } = chosen.value;

    if (booking.status === "booked") {
      const moved = transitionBooking("change", this.context(booking, facts, now));
      if (!moved.ok) return err(deskError(moved.reason as never));
      const outcome = await this.deps.bookings.change(
        {
          bookingId,
          expectedSequence: body.version,
          slotStart,
          slotEnd,
          placesPerSlot: facts.settings.placesPerSlot,
          overCapacityReason: reason,
          lotIds: booking.lots.filter((l) => l.active).map((l) => l.lotId),
          collector: collectorOf(booking),
        },
        (tx, changed) =>
          this.record(tx, staff, collectionBookingChanged(changed, booking.slotStart)),
      );
      switch (outcome.outcome) {
        case "not_found":
          return err(deskError("booking_not_found"));
        case "stale":
          return err(deskError("booking_changed"));
        case "slot_full":
          return err(deskError("slot_full"));
        case "lot_taken":
          return err(
            deskError("lot_not_collectable", {
              lotId: outcome.lotIds[0] as string,
              reason: "already_booked",
            }),
          );
        case "changed":
          return ok(await this.viewOne(outcome.booking, facts.settings, facts, now));
      }
    }

    // A missed visit (or a cancelled one) is followed by a new booking for the same lots and collector.
    if (booking.status !== "not_collected" && booking.status !== "cancelled") {
      return err(deskError("booking_closed"));
    }
    const lotIds = booking.lots
      .filter((lot) => lot.outcome !== "collected")
      .map((lot) => lot.lotId);
    if (lotIds.length === 0) return err(deskError("no_lots"));
    const outcome = await this.deps.bookings.book(
      {
        legalEntityId: booking.legalEntityId,
        venueId: booking.venueId,
        slotStart,
        slotEnd,
        placesPerSlot: facts.settings.placesPerSlot,
        overCapacityReason: reason,
        lotIds,
        collector: collectorOf(booking),
        bookedByUserId: staff.userId,
        bookedVia: "staff",
        idempotencyKey: `rebook-${booking.id}-${slotStart.getTime()}`,
      },
      (tx, created) => this.record(tx, staff, collectionBookingCreated(created)),
    );
    return this.bookedOutcome(outcome, facts, now).then((r) => r.map((value) => value.booking));
  }

  async bookForClient(
    staff: DeskStaff,
    body: CollectionDeskBookForClientBody,
  ): Promise<CollectionDeskResult<{ booking: DeskBookingView; replayed: boolean }>> {
    const lotIds = [...body.lotIds];
    if (new Set(lotIds).size !== lotIds.length) return err(deskError("duplicate_lots"));
    if (lotIds.length > MAX_LOTS) return err(deskError("too_many_lots"));

    const found = await this.deps.facts.read(lotIds);
    const records = [];
    for (const lotId of lotIds) {
      const record = found.get(lotId);
      if (!record || record.buyerLegalEntityId !== body.legalEntityId) {
        return err(deskError("lot_not_found"));
      }
      records.push(record);
    }
    const withoutPlace = records.find((record) => record.venueId === null);
    if (withoutPlace) return err(deskError("lot_not_collectable", { lotId: withoutPlace.lotId }));
    const selection = records.map((record) => ({
      lotId: record.lotId,
      accountId: body.legalEntityId,
      placeId: record.venueId as string,
    }));
    const selectionRefusal = lotSelectionRefusal(selection);
    if (selectionRefusal === "mixed_places" || selectionRefusal === "mixed_accounts") {
      return err(deskError("mixed_places"));
    }
    for (const record of records) {
      const decision = collectionEligibility(record.facts);
      if (!decision.eligible) {
        return err(
          deskError("lot_not_collectable", { lotId: record.lotId, reason: decision.reason }),
        );
      }
    }
    const venueId = records[0]?.venueId as string;
    const settings = await this.deps.places.find(venueId);
    if (!settings) return err(deskError("place_not_set_up"));

    // A phone booking has no signed-in account holder: staff record that the client authorised it.
    const collector = resolveCollector({
      kind: body.collector.kind,
      name: body.collector.name,
      email: body.collector.email ?? null,
      company: body.collector.company ?? null,
      authorised: body.collector.authorised ?? false,
    });
    if (!collector.ok) return err(deskError("collector_invalid", { issues: collector.issues }));

    const now = this.deps.now();
    const slotStart = new Date(body.slotStart);
    const facts = await this.placeFacts(venueId, londonDateKey(slotStart));
    const chosen = await this.chooseSlot(
      venueId,
      facts,
      slotStart,
      null,
      now,
      body.override?.reason,
    );
    if (chosen.isErr()) return err(chosen.error);
    const { slotEnd, reason } = chosen.value;
    const input: CollectionCollectorInput = {
      kind: collector.collector.kind,
      name: collector.collector.name,
      email: collector.collector.email,
      company: collector.collector.company,
      userId: null,
      authorisedByUserId: collector.collector.authorised ? staff.userId : null,
      authorisedAt: collector.collector.authorised ? now : null,
      policyVersion: collector.collector.authorised
        ? COLLECTION_AUTHORISATION_POLICY_VERSION
        : null,
    };
    const outcome = await this.deps.bookings.book(
      {
        legalEntityId: body.legalEntityId,
        venueId,
        slotStart,
        slotEnd,
        placesPerSlot: facts.settings.placesPerSlot,
        overCapacityReason: reason,
        lotIds,
        collector: input,
        bookedByUserId: staff.userId,
        bookedVia: "staff",
        idempotencyKey: body.idempotencyKey,
      },
      (tx, created) => this.record(tx, staff, collectionBookingCreated(created)),
    );
    return this.bookedOutcome(outcome, facts, now);
  }

  // ---- internals ----------------------------------------------------------------------------

  private async bookedOutcome(
    outcome: Awaited<ReturnType<ICollectionBookingWriter["book"]>>,
    facts: PlaceFacts,
    now: Date,
  ): Promise<CollectionDeskResult<{ booking: DeskBookingView; replayed: boolean }>> {
    switch (outcome.outcome) {
      case "booked":
      case "replayed":
        return ok({
          booking: await this.viewOne(outcome.booking, facts.settings, facts, now),
          replayed: outcome.outcome === "replayed",
        });
      case "slot_full":
        return err(deskError("slot_full"));
      case "key_reused":
        return err(deskError("idempotency_key_reused"));
      case "lot_taken":
        return err(
          deskError("lot_not_collectable", {
            lotId: outcome.lotIds[0] as string,
            reason: "already_booked",
          }),
        );
    }
  }

  /**
   * Whether a time can be booked by staff: it must be one the place offers. Full, or inside the
   * notice period, it needs the reason staff give; the reason is stored with the booking.
   */
  private async chooseSlot(
    venueId: string,
    facts: PlaceFacts,
    slotStart: Date,
    moving: CollectionBookingRecord | null,
    now: Date,
    reason: string | undefined,
  ): Promise<CollectionDeskResult<{ slotEnd: Date; reason: string | null }>> {
    const date = londonDateKey(slotStart);
    const offered = collectionSlots({
      hours: facts.hours,
      exceptions: facts.exceptions,
      rules: { ...facts.settings, windowDays: 1 },
      now: new Date(`${date}T12:00:00.000Z`),
    })[0];
    const slot = offered?.slots.find((s) => s.start.getTime() === slotStart.getTime());
    if (!slot) return err(deskError("slot_unknown"));
    const taken = await this.deps.bookings.takenPlaces(venueId, {
      from: slotStart,
      to: new Date(slotStart.getTime() + 1),
    });
    let count = taken.get(slotStart.getTime()) ?? 0;
    if (moving?.status === "booked" && moving.slotStart.getTime() === slotStart.getTime())
      count -= 1;
    const full = count >= facts.settings.placesPerSlot;
    const calendar = createCollectionCalendar({
      hours: facts.hours,
      exceptions: facts.exceptions,
      rules: facts.settings,
    });
    const deadline = noticeDeadline(slotStart, facts.settings, calendar);
    const late = deadline === null || now.getTime() > deadline.getTime();
    if ((full || late) && !reason) {
      return err(deskError(full ? "slot_full" : "notice_passed"));
    }
    return ok({ slotEnd: slot.end, reason: full || late ? (reason ?? null) : null });
  }

  /** The reason a ticked lot cannot be handed over now: a check opened since it was booked. */
  private async holdOn(lotIds: readonly string[]) {
    const found = await this.deps.facts.read(lotIds);
    for (const lotId of lotIds) {
      const record = found.get(lotId);
      if (!record) return deskError("lot_not_found", { lotId });
      // The lot is in this very booking, and is released: neither stands in the way.
      const decision = collectionEligibility({ ...record.facts, activeBookingId: null });
      if (!decision.eligible) return deskError("hold_open", { lotId, reason: decision.reason });
    }
    return null;
  }

  /** Puts a hand-over back after a lot's fulfilment would not move, so booking and fulfilment agree. */
  private async rollBackHandOver(
    staff: DeskStaff,
    bookingId: string,
    handed: readonly string[],
    now: Date,
  ): Promise<void> {
    for (const lotId of handed) await this.deps.fulfilment.undoCollectionHandOver({ lotId });
    await this.deps.bookings.undoHandOver({ bookingId, at: now }, (tx, undone) =>
      this.record(tx, staff, collectionBookingHandOverUndone(undone)),
    );
  }

  private context(
    booking: CollectionBookingRecord,
    facts: PlaceFacts,
    now: Date,
  ): TransitionContext {
    const rules: CollectionRules = facts.settings;
    return {
      status: booking.status,
      actor: "staff",
      now,
      slotStart: booking.slotStart,
      handedOverAt: booking.outcomeAt,
      rules,
      calendar: createCollectionCalendar({
        hours: facts.hours,
        exceptions: facts.exceptions,
        rules,
      }),
    };
  }

  private async placeFacts(venueId: string, date: string): Promise<PlaceFacts> {
    return this.deps.places.readCalendarFacts(venueId, {
      from: addDaysToKey(date, -NOTICE_LOOKBACK_DAYS),
      to: addDaysToKey(date, 1),
    });
  }

  private async missed(
    venueId: string,
    settings: CollectionPlaceSettings,
    facts: PlaceFacts,
    now: Date,
  ): Promise<DeskBookingView[]> {
    const missed = await this.deps.bookings.listByStatus(venueId, ["not_collected"], LIST_LIMIT);
    // A visit someone has already rebooked is followed up: it leaves the list.
    const live = await this.deps.bookings.findLiveByLots(
      missed.flatMap((booking) => booking.lots.map((lot) => lot.lotId)),
    );
    const open = missed.filter((booking) => !booking.lots.some((lot) => live.has(lot.lotId)));
    return this.views(open, settings, facts, now);
  }

  private async viewOne(
    booking: CollectionBookingRecord,
    settings: CollectionPlaceSettings,
    facts: PlaceFacts,
    now: Date,
  ): Promise<DeskBookingView> {
    return (await this.views([booking], settings, facts, now))[0] as DeskBookingView;
  }

  private async views(
    bookings: readonly CollectionBookingRecord[],
    settings: CollectionPlaceSettings,
    facts: PlaceFacts,
    now: Date,
  ): Promise<DeskBookingView[]> {
    if (bookings.length === 0) return [];
    const lots = await this.deps.desk.lots(
      bookings.flatMap((booking) => booking.lots.map((lot) => lot.lotId)),
    );
    const names = await this.deps.desk.accountNames(bookings.map((b) => b.legalEntityId));
    return bookings.map((booking) => {
      const lotViews: DeskLotView[] = booking.lots.map((lot) => {
        const info = lots.get(lot.lotId);
        const status = (info?.fulfilmentStatus ?? "none") as DeskFulfilmentStatus;
        return {
          lotId: lot.lotId,
          title: info?.title ?? "Lot",
          lotNumber: info?.lotNumber ?? null,
          image: info?.image ?? null,
          released: RELEASED.includes(status),
          fulfilmentStatus: status,
          active: lot.active,
          outcome: lot.outcome,
        };
      });
      const actions = this.actionsOf(booking, facts, now);
      const unreleased = lotViews.some((lot) => lot.active && !lot.released);
      const handedOverAt =
        booking.outcomeAt &&
        (booking.status === "collected" || booking.status === "partly_collected")
          ? booking.outcomeAt
          : null;
      return {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        start: booking.slotStart.toISOString(),
        end: booking.slotEnd.toISOString(),
        version: booking.icsSequence,
        buyer: { id: booking.legalEntityId, name: names.get(booking.legalEntityId) ?? "Account" },
        bookedVia: booking.bookedVia,
        overCapacity: booking.overCapacity,
        collector: {
          kind: booking.collector.kind,
          name: booking.collector.name,
          company: booking.collector.company,
        },
        lots: lotViews,
        idCheckType: booking.idCheckType,
        handedOverAt: handedOverAt?.toISOString() ?? null,
        undoUntil: handedOverAt
          ? new Date(handedOverAt.getTime() + settings.undoHandOverMinutes * 60_000).toISOString()
          : null,
        actions,
        handOverBlocked: booking.status === "booked" && unreleased ? "not_released" : null,
      };
    });
  }

  private actionsOf(booking: CollectionBookingRecord, facts: PlaceFacts, now: Date): DeskAction[] {
    const allowed = allowedBookingActions(this.context(booking, facts, now));
    const out: DeskAction[] = [];
    if (allowed.includes("hand_over_all") || allowed.includes("hand_over_some"))
      out.push("hand_over");
    if (allowed.includes("mark_not_collected")) out.push("not_collected");
    if (allowed.includes("undo_hand_over")) out.push("undo");
    if (allowed.includes("change") || booking.status === "not_collected") out.push("rebook");
    return out;
  }

  private async record(
    tx: Parameters<IDomainEventSink["withTx"]>[0],
    staff: DeskStaff,
    event: CollectionBookingEvent,
  ): Promise<void> {
    await this.deps.events.withTx(tx).publish({
      aggregateType: COLLECTION_BOOKING_EVENT_AGGREGATE,
      aggregateId: event.payload.bookingId,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: staff.userId,
      actingLegalEntityId: event.payload.legalEntityId,
    });
  }
}

/** Bookings that hold a place in their time: a visit still to come, or one that took place. */
const TAKES_A_PLACE: readonly string[] = ["booked", "collected", "partly_collected"];

function collectorOf(booking: CollectionBookingRecord): CollectionCollectorInput {
  return {
    kind: booking.collector.kind,
    name: booking.collector.name,
    email: booking.collector.email,
    company: booking.collector.company,
    userId: booking.collector.userId,
    authorisedByUserId: booking.authorisedByUserId,
    authorisedAt: booking.authorisedAt,
    policyVersion: booking.policyVersion,
  };
}
