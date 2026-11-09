import {
  type CollectionWeeklyHours,
  DEFAULT_COLLECTION_RULES,
  DEFAULT_COLLECTION_WEEKLY_HOURS,
  normaliseWeeklyHours,
} from "@auction/domain";
import type {
  AddCollectionException,
  AddExceptionOutcome,
  CancelCollectionBooking,
  CancelOutcome,
  CollectionBookingRecord,
  CollectionPlaceSettings,
  CollectionVenueChoice,
  GuardSettingsTransaction,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionSettingsReader,
  ICollectionSettingsWriter,
  RemoveCollectionException,
  RemoveExceptionOutcome,
  SaveCollectionSettings,
  SaveSettingsOutcome,
  SettingsField,
  StaffExceptionRecord,
  StaffSettingsRecord,
  WithinBookingTransaction,
  WithinSettingsTransaction,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../services/domain-event-sink.js";

export const SETTINGS_VENUE = "d0000000-0000-4000-8000-0000000000aa";
export const SETTINGS_NOW = new Date("2026-11-09T11:20:00Z");

/** One place's settings, hours and closures in memory, with the same version check as the database. */
export class InMemoryCollectionSettings
  implements ICollectionSettingsReader, ICollectionSettingsWriter
{
  settings: CollectionPlaceSettings = {
    ...DEFAULT_COLLECTION_RULES,
    venueId: SETTINGS_VENUE,
    onlineBookingEnabled: false,
    freeStorageDays: null,
    storageChargePence: null,
    bookingEmail: null,
    updatedAt: new Date("2026-11-01T09:00:00Z"),
  };
  hours: CollectionWeeklyHours[] = [...DEFAULT_COLLECTION_WEEKLY_HOURS];
  stored: StaffExceptionRecord[] = [];
  saleDays: StaffExceptionRecord[] = [];
  private nextId = 1;
  /** A hook that runs inside each change just before its guard: a test books a visit here. */
  beforeGuard: (() => Promise<void>) | null = null;

  async venues(): Promise<CollectionVenueChoice[]> {
    return [
      {
        venueId: SETTINGS_VENUE,
        name: "London Art Exchange, 156 New Cavendish Street",
        hasPlace: true,
        onlineBookingEnabled: this.settings.onlineBookingEnabled,
      },
    ];
  }

  async read(venueId: string): Promise<StaffSettingsRecord | null> {
    if (venueId !== SETTINGS_VENUE) return null;
    const exceptions = [...this.stored, ...this.saleDays].sort((a, b) =>
      a.startsOn.localeCompare(b.startsOn),
    );
    const sale = this.saleDays[0];
    return {
      settings: this.settings,
      hours: this.hours,
      exceptions,
      nextSaleDay:
        sale?.saleId && sale.saleTitle
          ? { saleId: sale.saleId, saleTitle: sale.saleTitle, startsOn: sale.startsOn }
          : null,
    };
  }

  async save(
    input: SaveCollectionSettings,
    within?: WithinSettingsTransaction<Extract<SaveSettingsOutcome, { outcome: "saved" }>>,
    guard?: GuardSettingsTransaction,
  ): Promise<SaveSettingsOutcome> {
    if (input.venueId !== SETTINGS_VENUE) return { outcome: "venue_not_found" };
    if (input.expectedUpdatedAt.getTime() !== this.settings.updatedAt.getTime()) {
      return { outcome: "stale" };
    }
    await this.beforeGuard?.();
    if (guard && !(await guard({} as never))) return { outcome: "affected_changed" };
    const before = this.settings;
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
    check("max_active_visits", before.maxActiveVisits, input.rules.maxActiveVisits);
    check("free_storage_days", before.freeStorageDays, input.freeStorageDays);
    check("storage_charge", before.storageChargePence, input.storageChargePence);
    check("booking_email", before.bookingEmail, input.bookingEmail);
    const week = normaliseWeeklyHours(input.hours);
    if (JSON.stringify(week) !== JSON.stringify(normaliseWeeklyHours(this.hours))) {
      changed.push("weekly_hours");
    }
    const settings: CollectionPlaceSettings = {
      ...input.rules,
      venueId: input.venueId,
      onlineBookingEnabled: input.onlineBookingEnabled,
      freeStorageDays: input.freeStorageDays,
      storageChargePence: input.storageChargePence,
      bookingEmail: input.bookingEmail,
      updatedAt: input.at,
    };
    const result = { outcome: "saved" as const, settings, hours: week, changed };
    await within?.({} as never, result);
    this.settings = settings;
    this.hours = week;
    return result;
  }

  async addException(
    input: AddCollectionException,
    within?: WithinSettingsTransaction<StaffExceptionRecord>,
    guard?: GuardSettingsTransaction,
  ): Promise<AddExceptionOutcome> {
    if (input.venueId !== SETTINGS_VENUE) return { outcome: "venue_not_found" };
    await this.beforeGuard?.();
    if (guard && !(await guard({} as never))) return { outcome: "affected_changed" };
    const exception: StaffExceptionRecord = {
      id: `d0000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`,
      kind: input.draft.kind,
      startsOn: input.draft.startsOn,
      endsOn: input.draft.endsOn,
      opensLocal: input.draft.opensLocal,
      closesLocal: input.draft.closesLocal,
      source: "staff",
      reasonInternal: input.reasonInternal,
      saleId: null,
      saleTitle: null,
      createdByUserId: input.createdByUserId,
      createdAt: SETTINGS_NOW,
    };
    await within?.({} as never, exception);
    this.stored.push(exception);
    return { outcome: "added", exception };
  }

  async removeException(
    input: RemoveCollectionException,
    within?: WithinSettingsTransaction<StaffExceptionRecord>,
    guard?: GuardSettingsTransaction,
  ): Promise<RemoveExceptionOutcome> {
    await this.beforeGuard?.();
    if (guard && !(await guard({} as never))) return { outcome: "affected_changed" };
    const found = this.stored.find((e) => e.id === input.exceptionId);
    if (!found) return { outcome: "not_found" };
    await within?.({} as never, found);
    this.stored = this.stored.filter((e) => e !== found);
    return { outcome: "removed", exception: found };
  }
}

/** Bookings to list and cancel, as far as the settings service needs them. */
export class InMemorySettingsBookings
  implements ICollectionBookingReader, Pick<ICollectionBookingWriter, "cancel">
{
  constructor(readonly bookings: CollectionBookingRecord[] = []) {}

  async findById(id: string) {
    return this.bookings.find((b) => b.id === id) ?? null;
  }
  async hasIdempotencyKey() {
    return false;
  }
  async findByReference(reference: string) {
    return this.bookings.find((b) => b.reference === reference) ?? null;
  }
  async listForAccount(legalEntityId: string, limit: number) {
    return this.bookings.filter((b) => b.legalEntityId === legalEntityId).slice(0, limit);
  }
  async countBooked(legalEntityId: string) {
    return this.bookings.filter((b) => b.legalEntityId === legalEntityId && b.status === "booked")
      .length;
  }
  async listInRange(venueId: string, range: { from: Date; to: Date }) {
    return this.bookings.filter(
      (b) => b.venueId === venueId && b.slotStart >= range.from && b.slotStart < range.to,
    );
  }
  async findLiveByLots() {
    return new Map<string, CollectionBookingRecord>();
  }
  async takenPlaces() {
    return new Map<number, number>();
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
    await within?.({} as never, cancelled);
    this.bookings[this.bookings.indexOf(booking)] = cancelled;
    return { outcome: "cancelled", booking: cancelled };
  }
}

/** The id `visitOn` gives the visit with this short id. */
export const visitId = (id: string): string => `d1000000-0000-4000-8000-${id.padStart(12, "0")}`;

export function visitOn(
  id: string,
  start: string,
  over: Partial<CollectionBookingRecord> = {},
): CollectionBookingRecord {
  const slotStart = new Date(start);
  return {
    id: visitId(id),
    reference: `COL-${id}`,
    legalEntityId: "d2000000-0000-4000-8000-000000000001",
    venueId: SETTINGS_VENUE,
    slotStart,
    slotEnd: new Date(slotStart.getTime() + 30 * 60_000),
    seat: 1,
    status: "booked",
    bookedByUserId: "buyer-1",
    bookedVia: "client",
    overCapacity: false,
    overCapacityReason: null,
    collector: { kind: "self", name: "Maya Okafor", email: null, company: null, userId: "buyer-1" },
    authorisedByUserId: null,
    authorisedAt: null,
    policyVersion: null,
    icsSequence: 0,
    idCheckType: null,
    outcomeByUserId: null,
    outcomeAt: null,
    cancelledByUserId: null,
    cancelledAt: null,
    personalDetailsErasedAt: null,
    lots: [
      { lotId: `d3000000-0000-4000-8000-${id.padStart(12, "0")}`, active: true, outcome: null },
    ],
    createdAt: SETTINGS_NOW,
    updatedAt: SETTINGS_NOW,
    ...over,
  };
}

export class RecordedEvents implements IDomainEventSink {
  readonly events: Array<Parameters<IDomainEventSink["publish"]>[0]> = [];
  async publish(event: Parameters<IDomainEventSink["publish"]>[0]): Promise<void> {
    this.events.push(event);
  }
  withTx(): IDomainEventSink {
    return this;
  }
}
