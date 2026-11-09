import {
  COLLECTION_AUTHORISATION_POLICY_VERSION,
  type CollectionIdType,
  collectionBookingChanged,
  collectionBookingCreated,
  collectionBookingHandOverUndone,
  collectionBookingHandedOver,
  collectionBookingNotCollected,
  collectionEligibility,
  collectionSlots,
  createCollectionCalendar,
  handOverRefusal,
  londonDateKey,
  lotSelectionRefusal,
  noticeDeadline,
  resolveCollector,
  transitionBooking,
} from "@auction/domain";
import type {
  CollectionBookingRecord,
  CollectionCollectorInput,
  ICollectionBookingWriter,
} from "@auction/persistence/interfaces";
import type { DeskBookingView } from "@auction/types";
import type {
  CollectionDeskBookForClientBody,
  CollectionDeskHandOverBody,
  CollectionDeskRebookBody,
} from "@auction/validators";
import { err, ok } from "neverthrow";
import type { DeskStaff } from "../interfaces/collection-desk-service.js";
import {
  type CollectionDeskResult,
  deskError,
  transitionRefusal,
} from "./collection-desk.errors.js";
import {
  type DeskSupport,
  MAX_LOTS,
  type PlaceFacts,
  collectorOf,
  isReleased,
} from "./collection-desk.shared.js";

/** A lot's fulfilment would not move inside the booking's transaction; the whole change is undone. */
class LotFulfilmentRefused extends Error {
  constructor(readonly lotId: string) {
    super(`The fulfilment of lot ${lotId} could not be moved`);
  }
}

/**
 * What staff do at the desk: hand over, undo, mark a visit missed, rebook, and book for a client.
 * A hand-over and its undo are each one transaction: the booking, each lot's fulfilment and the
 * event commit together or not at all, so there is nothing to put back afterwards.
 */
export class CollectionDeskCommands {
  constructor(private readonly support: DeskSupport) {}

  private get deps() {
    return this.support.deps;
  }

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
    const facts = await this.support.placeFacts(booking.venueId, londonDateKey(booking.slotStart));

    if (booking.status !== "booked") return err(deskError("booking_closed"));
    const live = booking.lots.filter((lot) => lot.active).map((lot) => lot.lotId);
    const ticked = [...new Set(body.lotIds)];
    const strangers = ticked.filter((id) => !live.includes(id));
    if (strangers.length > 0) return err(deskError("lot_not_in_booking", { lotIds: strangers }));
    const action = ticked.length === live.length ? "hand_over_all" : "hand_over_some";
    const moved = transitionBooking(action, this.support.context(booking, facts, now));
    if (!moved.ok) return err(transitionRefusal(moved.reason));

    // Release first: the lots must be released, and the ID checked.
    const desk = await this.deps.desk.lots(ticked);
    const lots = ticked.map((lotId) => ({
      lotId,
      released: isReleased(desk.get(lotId)?.fulfilmentStatus ?? ""),
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

    try {
      const outcome = await this.deps.bookings.recordHandOver(
        {
          bookingId,
          handedOverLotIds: ticked,
          idCheckType: body.idCheck.type as CollectionIdType,
          staffUserId: staff.userId,
          at: now,
        },
        async (tx, handed) => {
          // Each lot's fulfilment closes, naming who collected and who handed it over, in this same
          // transaction; a lot someone else has moved stops the whole hand-over.
          const closed = await this.deps.fulfilment.handOver(tx, {
            bookingId,
            lotIds: ticked,
            collectedBy: booking.collector.name,
            actorUserId: staff.userId,
            at: now,
          });
          if (!closed.ok) throw new LotFulfilmentRefused(closed.lotId);
          // The event is written last, once everything it reports has been done.
          await this.support.record(
            tx,
            staff,
            collectionBookingHandedOver(handed, {
              handedOverLotIds: ticked,
              leftLotIds: handed.lots.filter((l) => l.outcome === "left").map((l) => l.lotId),
              idCheckType: body.idCheck.type as CollectionIdType,
              status: handed.status === "collected" ? "collected" : "partly_collected",
            }),
          );
        },
      );
      switch (outcome.outcome) {
        case "not_found":
          return err(deskError("booking_not_found"));
        case "stale":
          return err(deskError("booking_changed"));
        case "lot_not_in_booking":
          return err(deskError("lot_not_in_booking", { lotIds: outcome.lotIds }));
        case "handed_over":
          return ok(await this.support.viewOne(outcome.booking, facts.settings, facts, now));
      }
    } catch (error) {
      if (error instanceof LotFulfilmentRefused) {
        return err(deskError("lot_changed", { lotId: error.lotId }));
      }
      throw error;
    }
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
    const facts = await this.support.placeFacts(booking.venueId, londonDateKey(booking.slotStart));
    const moved = transitionBooking("undo_hand_over", {
      ...this.support.context(booking, facts, now),
      handedOverAt: booking.outcomeAt,
    });
    if (!moved.ok) return err(transitionRefusal(moved.reason));

    try {
      const outcome = await this.deps.bookings.undoHandOver(
        { bookingId, at: now },
        async (tx, undone) => {
          // Each lot goes back to exactly the status it was in before the hand-over.
          const restored = await this.deps.fulfilment.undoHandOver(tx, bookingId);
          if (!restored.ok) throw new LotFulfilmentRefused(restored.lotId);
          await this.support.record(tx, staff, collectionBookingHandOverUndone(undone));
        },
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
          return ok(await this.support.viewOne(outcome.booking, facts.settings, facts, now));
      }
    } catch (error) {
      if (error instanceof LotFulfilmentRefused) {
        return err(deskError("lot_changed", { lotId: error.lotId }));
      }
      throw error;
    }
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
    const facts = await this.support.placeFacts(booking.venueId, londonDateKey(booking.slotStart));
    const moved = transitionBooking(
      "mark_not_collected",
      this.support.context(booking, facts, now),
    );
    if (!moved.ok) return err(transitionRefusal(moved.reason));
    const outcome = await this.deps.bookings.markNotCollected(
      { bookingId, staffUserId: staff.userId, at: now },
      (tx, marked) => this.support.record(tx, staff, collectionBookingNotCollected(marked)),
    );
    if (outcome.outcome === "not_found") return err(deskError("booking_not_found"));
    if (outcome.outcome === "stale") return err(deskError("booking_changed"));
    return ok(await this.support.viewOne(outcome.booking, facts.settings, facts, now));
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
    const facts = await this.support.placeFacts(booking.venueId, londonDateKey(slotStart));
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
      const moved = transitionBooking("change", this.support.context(booking, facts, now));
      if (!moved.ok) return err(transitionRefusal(moved.reason));
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
          this.support.record(tx, staff, collectionBookingChanged(changed, booking.slotStart)),
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
          return ok(await this.support.viewOne(outcome.booking, facts.settings, facts, now));
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
    // The lots are looked at again: a check may have opened, or a lot been refunded, since the
    // first booking, exactly as when booking for a client.
    const records = await this.collectableRecords(lotIds, booking.legalEntityId);
    if (records.isErr()) return err(records.error);
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
      (tx, created) => this.support.record(tx, staff, collectionBookingCreated(created)),
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

    const records = await this.collectableRecords(lotIds, body.legalEntityId);
    if (records.isErr()) return err(records.error);
    const venueId = records.value[0]?.venueId as string;
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
    const facts = await this.support.placeFacts(venueId, londonDateKey(slotStart));
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
      (tx, created) => this.support.record(tx, staff, collectionBookingCreated(created)),
    );
    return this.bookedOutcome(outcome, facts, now);
  }

  // ---- internals ----------------------------------------------------------------------------

  /**
   * The lots as booking records, after the rules every collection booking keeps: each belongs to
   * the account, is collected from one place, and is paid and cleared (no check open).
   */
  private async collectableRecords(lotIds: readonly string[], legalEntityId: string) {
    const found = await this.deps.facts.read(lotIds);
    const records = [];
    for (const lotId of lotIds) {
      const record = found.get(lotId);
      if (!record || record.buyerLegalEntityId !== legalEntityId) {
        return err(deskError("lot_not_found"));
      }
      records.push(record);
    }
    const withoutPlace = records.find((record) => record.venueId === null);
    if (withoutPlace) return err(deskError("lot_not_collectable", { lotId: withoutPlace.lotId }));
    const refusal = lotSelectionRefusal(
      records.map((record) => ({
        lotId: record.lotId,
        accountId: legalEntityId,
        placeId: record.venueId as string,
      })),
    );
    if (refusal === "mixed_places" || refusal === "mixed_accounts") {
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
    return ok(records);
  }

  private async bookedOutcome(
    outcome: Awaited<ReturnType<ICollectionBookingWriter["book"]>>,
    facts: PlaceFacts,
    now: Date,
  ): Promise<CollectionDeskResult<{ booking: DeskBookingView; replayed: boolean }>> {
    switch (outcome.outcome) {
      case "booked":
      case "replayed":
        return ok({
          booking: await this.support.viewOne(outcome.booking, facts.settings, facts, now),
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
}
