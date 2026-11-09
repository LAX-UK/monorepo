import {
  COLLECTION_BOOKING_EVENT_AGGREGATE,
  type CollectionBookingEvent,
  type CollectionRules,
  HAND_OVER_FROM_STATUSES,
  type TransitionContext,
  addDaysToKey,
  allowedBookingActions,
  createCollectionCalendar,
} from "@auction/domain";
import type {
  CollectionBookingRecord,
  CollectionCollectorInput,
  CollectionPlaceSettings,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionDeskFulfilment,
  ICollectionDeskReader,
  ICollectionLotFactsReader,
  ICollectionOutcomeWriter,
  ICollectionPlaceRepository,
} from "@auction/persistence/interfaces";
import type {
  DeskAction,
  DeskBookingView,
  DeskFulfilmentStatus,
  DeskLotView,
} from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { DeskStaff } from "../interfaces/collection-desk-service.js";

export const DAY_MS = 24 * 60 * 60_000;
const NOTICE_LOOKBACK_DAYS = 61;
/** The most visits a list shows; the screen says when there are more. */
export const LIST_LIMIT = 200;
export const MAX_LOTS = 20;

/** Bookings that hold a place in their time: a visit still to come, or one that took place. */
export const TAKES_A_PLACE: readonly string[] = ["booked", "collected", "partly_collected"];

export type CollectionDeskDeps = {
  places: Pick<ICollectionPlaceRepository, "find" | "readCalendarFacts">;
  bookings: ICollectionBookingReader & ICollectionBookingWriter & ICollectionOutcomeWriter;
  desk: ICollectionDeskReader;
  facts: Pick<ICollectionLotFactsReader, "read" | "lotIdsForBuyer">;
  /** Moves each lot's fulfilment inside the booking's own transaction. */
  fulfilment: ICollectionDeskFulfilment;
  events: IDomainEventSink;
  now: () => Date;
};

export type PlaceFacts = Awaited<ReturnType<CollectionDeskDeps["places"]["readCalendarFacts"]>>;

/**
 * What the desk's reads and commands share: the place's facts, the booking-state context, a
 * booking as the desk shows it, and the one way an event is written in the booking's transaction.
 */
export class DeskSupport {
  constructor(readonly deps: CollectionDeskDeps) {}

  async placeFacts(venueId: string, date: string): Promise<PlaceFacts> {
    return this.deps.places.readCalendarFacts(venueId, {
      from: addDaysToKey(date, -NOTICE_LOOKBACK_DAYS),
      to: addDaysToKey(date, 1),
    });
  }

  context(booking: CollectionBookingRecord, facts: PlaceFacts, now: Date): TransitionContext {
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

  /** Visits marked not collected that nobody has followed up (rebooked), newest first. */
  async missed(
    venueId: string,
    settings: CollectionPlaceSettings,
    facts: PlaceFacts,
    now: Date,
  ): Promise<{ items: DeskBookingView[]; more: boolean }> {
    const fetched = await this.deps.bookings.listByStatus(
      venueId,
      ["not_collected"],
      LIST_LIMIT + 1,
    );
    const more = fetched.length > LIST_LIMIT;
    const missed = fetched.slice(0, LIST_LIMIT);
    // A visit someone has already rebooked is followed up: it leaves the list.
    const live = await this.deps.bookings.findLiveByLots(
      missed.flatMap((booking) => booking.lots.map((lot) => lot.lotId)),
    );
    const open = missed.filter((booking) => !booking.lots.some((lot) => live.has(lot.lotId)));
    return { items: await this.views(open, settings, facts, now), more };
  }

  async viewOne(
    booking: CollectionBookingRecord,
    settings: CollectionPlaceSettings,
    facts: PlaceFacts,
    now: Date,
  ): Promise<DeskBookingView> {
    return (await this.views([booking], settings, facts, now))[0] as DeskBookingView;
  }

  async views(
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
          released: isReleased(status),
          fulfilmentStatus: status,
          active: lot.active,
          outcome: lot.outcome,
        };
      });
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
        actions: this.actionsOf(booking, facts, now),
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

  /** Writes the booking's event in its own transaction, under the staff member's name. */
  async record(
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

/** Whether staff have released the work, so it can be handed over. */
export function isReleased(status: string): boolean {
  return (HAND_OVER_FROM_STATUSES as readonly string[]).includes(status);
}

export function collectorOf(booking: CollectionBookingRecord): CollectionCollectorInput {
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
