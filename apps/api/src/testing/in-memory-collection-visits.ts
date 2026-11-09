import {
  type CollectionException,
  type CollectionLotFacts,
  type CollectionWeeklyHours,
  DEFAULT_COLLECTION_RULES,
  DEFAULT_COLLECTION_WEEKLY_HOURS,
} from "@auction/domain";
import type {
  BookingOutcome,
  CancelCollectionBooking,
  CancelOutcome,
  ChangeCollectionBooking,
  ChangeOutcome,
  CollectionBookingRecord,
  CollectionCalendarFacts,
  CollectionLotRecord,
  CollectionPlaceSettings,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionLotFactsReader,
  ICollectionPlaceRepository,
  NewCollectionBooking,
  WithinBookingTransaction,
} from "@auction/persistence/interfaces";
import { collectionRequestCanonical } from "@auction/persistence/lib";
import type { IDomainEventSink } from "../services/domain-event-sink.js";

export const COLLECTION_ACCOUNT = "c0000000-0000-4000-8000-000000000001";
export const OTHER_COLLECTION_ACCOUNT = "c0000000-0000-4000-8000-000000000002";
export const COLLECTION_VENUE = "c0000000-0000-4000-8000-0000000000aa";
export const COLLECTION_LOTS = {
  one: "c0000000-0000-4000-8000-0000000000a1",
  two: "c0000000-0000-4000-8000-0000000000a2",
  three: "c0000000-0000-4000-8000-0000000000a3",
  agentWin: "c0000000-0000-4000-8000-0000000000a4",
  unpaid: "c0000000-0000-4000-8000-0000000000a5",
  otherAccount: "c0000000-0000-4000-8000-0000000000a6",
  otherPlace: "c0000000-0000-4000-8000-0000000000a7",
} as const;
export const OTHER_VENUE = "c0000000-0000-4000-8000-0000000000bb";

/** Monday 9 November 2026, 11:20 GMT: the example in the design. */
export const COLLECTION_NOW = new Date("2026-11-09T11:20:00Z");

const READY: CollectionLotFacts = {
  paymentCleared: true,
  openChecks: [],
  organisationStatus: "approved",
  disputeOpen: false,
  refundOpen: false,
  fulfilment: "none",
  activeBookingId: null,
};

export function collectionLot(
  lotId: string,
  over: Omit<Partial<CollectionLotRecord>, "facts"> & { facts?: Partial<CollectionLotFacts> } = {},
): CollectionLotRecord {
  const { facts, ...rest } = over;
  return {
    lotId,
    title: `Lot ${lotId.slice(-1)}`,
    lotNumber: Number(lotId.slice(-1)),
    buyerLegalEntityId: COLLECTION_ACCOUNT,
    buyerAccountKind: "organisation",
    winnerId: "owner-1",
    venueId: COLLECTION_VENUE,
    facts: { ...READY, ...facts },
    ...rest,
  };
}

export function seedCollectionLots(): CollectionLotRecord[] {
  return [
    collectionLot(COLLECTION_LOTS.one),
    collectionLot(COLLECTION_LOTS.two),
    collectionLot(COLLECTION_LOTS.three),
    collectionLot(COLLECTION_LOTS.agentWin, { winnerId: "buyer_agent-1" }),
    collectionLot(COLLECTION_LOTS.unpaid, { facts: { paymentCleared: false } }),
    collectionLot(COLLECTION_LOTS.otherAccount, { buyerLegalEntityId: OTHER_COLLECTION_ACCOUNT }),
    collectionLot(COLLECTION_LOTS.otherPlace, { venueId: OTHER_VENUE }),
  ];
}

export class InMemoryCollectionLotFacts implements ICollectionLotFactsReader {
  constructor(readonly records: CollectionLotRecord[] = seedCollectionLots()) {}

  async lotIdsForBuyer(legalEntityId: string, venueId: string, limit: number): Promise<string[]> {
    return this.records
      .filter((r) => r.buyerLegalEntityId === legalEntityId && r.venueId === venueId)
      .slice(0, limit)
      .map((r) => r.lotId);
  }

  async read(lotIds: readonly string[]): Promise<Map<string, CollectionLotRecord>> {
    return new Map(
      this.records.filter((r) => lotIds.includes(r.lotId)).map((record) => [record.lotId, record]),
    );
  }
}

export class InMemoryCollectionPlaces
  implements
    Pick<ICollectionPlaceRepository, "find" | "ensure" | "readCalendarFacts" | "findAddress">
{
  settings: CollectionPlaceSettings = {
    ...DEFAULT_COLLECTION_RULES,
    venueId: COLLECTION_VENUE,
    onlineBookingEnabled: true,
    freeStorageDays: null,
    bookingEmail: "collections@lax.example",
    updatedAt: COLLECTION_NOW,
  };
  hours: CollectionWeeklyHours[] = [...DEFAULT_COLLECTION_WEEKLY_HOURS];
  exceptions: CollectionException[] = [];

  async find(venueId: string): Promise<CollectionPlaceSettings | null> {
    return venueId === COLLECTION_VENUE ? this.settings : null;
  }

  async ensure(venueId: string): Promise<CollectionPlaceSettings> {
    const found = await this.find(venueId);
    if (!found) throw new Error("no such place");
    return found;
  }

  async readCalendarFacts(): Promise<CollectionCalendarFacts> {
    return { settings: this.settings, hours: this.hours, exceptions: this.exceptions };
  }

  async findAddress(): Promise<{ name: string; address: string }> {
    return { name: "LAX gallery", address: "156 New Cavendish Street, London, W1W 6YW" };
  }
}

/** The events a service recorded, in order. */
export class RecordingEvents implements IDomainEventSink {
  readonly events: Array<Parameters<IDomainEventSink["publish"]>[0]> = [];
  async publish(event: Parameters<IDomainEventSink["publish"]>[0]): Promise<void> {
    this.events.push(event);
  }
  withTx(): IDomainEventSink {
    return this;
  }
}

/**
 * Bookings in memory, with the same rules the database enforces: one numbered place per live
 * booking in a slot, a lot in one live booking, a key that stands for one request, and a change
 * that is refused on a stale copy. The audit hook runs where the transaction would be.
 */
export class InMemoryCollectionBookings
  implements ICollectionBookingReader, ICollectionBookingWriter
{
  readonly bookings: CollectionBookingRecord[] = [];
  private readonly keys = new Map<string, { id: string; fingerprint: string }>();
  private sequence = 1000;
  /** Set to make the audit hook fail, to show the booking is not kept without its record. */
  failWithin: Error | null = null;

  async findById(id: string) {
    return this.bookings.find((b) => b.id === id) ?? null;
  }
  async hasIdempotencyKey(legalEntityId: string, key: string) {
    return this.keys.has(`${legalEntityId}:${key}`);
  }
  async findByReference(reference: string) {
    return this.bookings.find((b) => b.reference === reference) ?? null;
  }
  async listForAccount(legalEntityId: string, limit: number) {
    return this.bookings
      .filter((b) => b.legalEntityId === legalEntityId)
      .sort((a, b) => b.slotStart.getTime() - a.slotStart.getTime())
      .slice(0, limit);
  }
  async listInRange(venueId: string, range: { from: Date; to: Date }) {
    return this.bookings.filter(
      (b) => b.venueId === venueId && b.slotStart >= range.from && b.slotStart < range.to,
    );
  }
  async findLiveByLots(lotIds: readonly string[]) {
    const found = new Map<string, CollectionBookingRecord>();
    for (const booking of this.bookings.filter((b) => b.status === "booked")) {
      for (const lot of booking.lots.filter((l) => l.active && lotIds.includes(l.lotId))) {
        found.set(lot.lotId, booking);
      }
    }
    return found;
  }
  async takenPlaces(venueId: string) {
    const taken = new Map<number, number>();
    for (const b of this.bookings.filter((x) => x.venueId === venueId && x.status === "booked")) {
      taken.set(b.slotStart.getTime(), (taken.get(b.slotStart.getTime()) ?? 0) + 1);
    }
    return taken;
  }

  private heldElsewhere(lotIds: readonly string[], exceptId: string | null): string[] {
    return lotIds.filter((lotId) =>
      this.bookings.some(
        (b) =>
          b.id !== exceptId &&
          b.status === "booked" &&
          b.lots.some((l) => l.active && l.lotId === lotId),
      ),
    );
  }

  private freeSeat(venueId: string, slotStart: Date, places: number, exceptId: string | null) {
    const used = new Set(
      this.bookings
        .filter(
          (b) =>
            b.id !== exceptId &&
            b.venueId === venueId &&
            b.slotStart.getTime() === slotStart.getTime() &&
            b.status === "booked",
        )
        .map((b) => b.seat),
    );
    for (let seat = 1; seat <= places; seat += 1) if (!used.has(seat)) return seat;
    return null;
  }

  async book(
    input: NewCollectionBooking,
    within?: WithinBookingTransaction,
  ): Promise<BookingOutcome> {
    const fingerprint = collectionRequestCanonical(input);
    const prior = this.keys.get(`${input.legalEntityId}:${input.idempotencyKey}`);
    if (prior) {
      if (prior.fingerprint !== fingerprint) return { outcome: "key_reused" };
      return {
        outcome: "replayed",
        booking: this.bookings.find((b) => b.id === prior.id) as never,
      };
    }
    const held = this.heldElsewhere(input.lotIds, null);
    const seat = this.freeSeat(input.venueId, input.slotStart, input.placesPerSlot, null);
    if (seat === null) return { outcome: "slot_full" };
    if (held.length > 0) return { outcome: "lot_taken", lotIds: held };
    this.sequence += 1;
    const booking: CollectionBookingRecord = {
      id: `b0000000-0000-4000-8000-${String(this.sequence).padStart(12, "0")}`,
      reference: `COL-${this.sequence}`,
      legalEntityId: input.legalEntityId,
      venueId: input.venueId,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      seat,
      status: "booked",
      bookedByUserId: input.bookedByUserId,
      bookedVia: input.bookedVia,
      overCapacity: false,
      overCapacityReason: null,
      collector: {
        kind: input.collector.kind,
        name: input.collector.name,
        email: input.collector.email,
        company: input.collector.company,
        userId: input.collector.userId,
      },
      authorisedByUserId: input.collector.authorisedByUserId,
      authorisedAt: input.collector.authorisedAt,
      policyVersion: input.collector.policyVersion,
      icsSequence: 0,
      idCheckType: null,
      outcomeByUserId: null,
      outcomeAt: null,
      cancelledByUserId: null,
      cancelledAt: null,
      personalDetailsErasedAt: null,
      lots: [...new Set(input.lotIds)].map((lotId) => ({ lotId, active: true, outcome: null })),
      createdAt: COLLECTION_NOW,
      updatedAt: COLLECTION_NOW,
    };
    if (this.failWithin) throw this.failWithin;
    await within?.({} as never, booking);
    this.bookings.push(booking);
    this.keys.set(`${input.legalEntityId}:${input.idempotencyKey}`, {
      id: booking.id,
      fingerprint,
    });
    return { outcome: "booked", booking };
  }

  async change(
    input: ChangeCollectionBooking,
    within?: WithinBookingTransaction,
  ): Promise<ChangeOutcome> {
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking) return { outcome: "not_found" };
    if (booking.status !== "booked" || booking.icsSequence !== input.expectedSequence) {
      return { outcome: "stale" };
    }
    const held = this.heldElsewhere(input.lotIds, booking.id);
    if (held.length > 0) return { outcome: "lot_taken", lotIds: held };
    const sameSlot = booking.slotStart.getTime() === input.slotStart.getTime();
    const seat = sameSlot
      ? booking.seat
      : this.freeSeat(booking.venueId, input.slotStart, input.placesPerSlot, booking.id);
    if (seat === null) return { outcome: "slot_full" };
    const changed: CollectionBookingRecord = {
      ...booking,
      slotStart: input.slotStart,
      slotEnd: input.slotEnd,
      seat,
      collector: {
        kind: input.collector.kind,
        name: input.collector.name,
        email: input.collector.email,
        company: input.collector.company,
        userId: input.collector.userId,
      },
      authorisedByUserId: input.collector.authorisedByUserId,
      authorisedAt: input.collector.authorisedAt,
      policyVersion: input.collector.policyVersion,
      icsSequence: booking.icsSequence + 1,
      lots: [
        ...booking.lots
          .filter((l) => !input.lotIds.includes(l.lotId))
          .map((l) => ({ ...l, active: false })),
        ...input.lotIds.map((lotId) => ({ lotId, active: true, outcome: null })),
      ],
    };
    if (this.failWithin) throw this.failWithin;
    await within?.({} as never, changed);
    this.bookings[this.bookings.indexOf(booking)] = changed;
    return { outcome: "changed", booking: changed };
  }

  async cancel(
    input: CancelCollectionBooking,
    within?: WithinBookingTransaction,
  ): Promise<CancelOutcome> {
    const booking = this.bookings.find((b) => b.id === input.bookingId);
    if (!booking) return { outcome: "not_found" };
    if (booking.status !== "booked" || booking.icsSequence !== input.expectedSequence) {
      return { outcome: "stale" };
    }
    const cancelled: CollectionBookingRecord = {
      ...booking,
      status: "cancelled",
      cancelledAt: input.at,
      cancelledByUserId: input.cancelledByUserId,
      icsSequence: booking.icsSequence + 1,
      lots: booking.lots.map((l) => ({ ...l, active: false })),
    };
    if (this.failWithin) throw this.failWithin;
    await within?.({} as never, cancelled);
    this.bookings[this.bookings.indexOf(booking)] = cancelled;
    return { outcome: "cancelled", booking: cancelled };
  }
}
